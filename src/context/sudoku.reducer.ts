/*
 * Copyright (C) 2025  Henrique Almeida
 * This file is part of WASudoku.

 * WASudoku is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.

 * WASudoku is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.

 * You should have received a copy of the GNU Affero General Public License
 * along with WASudoku.  If not, see <https://www.gnu.org/licenses/>.
 */

import type { SudokuAction } from './sudoku.actions.types'
import type {
  BoardState,
  Elimination,
  SudokuState,
  SavedGameState,
  HistoryState,
} from './sudoku.types'
import {
  getRelatedCellIndices,
  validateBoard,
  areBoardsEqual,
  calculateCandidates,
} from '@/lib/utils'

const BOARD_SIZE = 81
const LOCAL_STORAGE_KEY = 'wasudoku-game-state'
const MAX_HISTORY_ENTRIES = 100

/**
 * Creates an empty Sudoku board.
 * @returns An array of 81 empty cell states.
 */
export const createEmptyBoard = (): BoardState =>
  Array(BOARD_SIZE)
    .fill(null)
    .map(() => ({
      value: null,
      candidates: new Set(),
      centers: new Set(),
    }))

/**
 * Calculates derived state properties from a board state.
 * @param board - The board to analyze.
 * @returns An object with derived properties like conflicts, emptiness, etc.
 */
function getDerivedBoardState(board: BoardState) {
  const conflicts = validateBoard(board)
  const hasValues = board.some((cell) => cell.value !== null)
  const isBoardFull = board.every((cell) => cell.value !== null)

  return {
    conflicts,
    isBoardEmpty: !hasValues,
    isBoardFull,
  }
}

/** The initial state of the Sudoku game. */
export const initialState: SudokuState = {
  board: createEmptyBoard(),
  initialBoard: createEmptyBoard(),
  history: {
    stack: [createEmptyBoard()],
    index: 0,
  },
  ui: {
    activeCellIndex: null,
    highlightedValue: null,
    inputMode: 'normal',
    lastError: null,
  },
  solver: {
    isSolving: false,
    isSolved: false,
    solveFailed: false,
    gameMode: 'playing',
    steps: [],
    currentStepIndex: null,
    visualizationBoard: null,
    candidatesForViz: null,
    eliminationsForViz: null,
  },
  derived: getDerivedBoardState(createEmptyBoard()),
}

/**
 * Custom JSON reviver to handle deserializing `Set` objects from localStorage.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function reviver(_key: string, value: any) {
  if (
    typeof value === 'object' &&
    value !== null &&
    value.__dataType === 'Set' &&
    Array.isArray(value.value)
  ) {
    return new Set(value.value)
  }
  return value
}

/**
 * Loads the initial game state from local storage or returns the default initial state.
 * This function is used to initialize the `useReducer` hook.
 * @returns The initial Sudoku state for the application.
 */
export function loadInitialState(): SudokuState {
  try {
    const savedStateJSON = window.localStorage.getItem(LOCAL_STORAGE_KEY)
    if (savedStateJSON) {
      const savedState = JSON.parse(savedStateJSON, reviver) as SavedGameState
      if (
        savedState?.history &&
        Array.isArray(savedState.history.stack) &&
        typeof savedState.history.index === 'number' &&
        savedState.history.stack.length > 0
      ) {
        const currentBoard = savedState.history.stack[savedState.history.index]
        return {
          ...initialState,
          history: savedState.history,
          board: currentBoard,
          derived: getDerivedBoardState(currentBoard),
        }
      }
    }
  } catch (error) {
    console.error('Failed to load game state from local storage:', error)
  }
  return initialState
}

/**
 * A helper function to manage the history stack. It adds a new board state,
 * truncates any future (redo) states, and prunes the oldest entry if the
 * history exceeds the maximum size.
 * @param historyState The current `HistoryState`.
 * @param currentBoard The current `BoardState` from the main state.
 * @param newBoard The `BoardState` to be added to the history.
 * @returns An updated `HistoryState` object.
 */
function updateHistory(
  historyState: HistoryState,
  currentBoard: BoardState,
  newBoard: BoardState,
): HistoryState {
  if (areBoardsEqual(currentBoard, newBoard)) {
    return historyState
  }

  let newStack = historyState.stack.slice(0, historyState.index + 1)
  newStack.push(newBoard)

  if (newStack.length > MAX_HISTORY_ENTRIES) {
    // Prune the oldest entry to keep the history size manageable.
    newStack = newStack.slice(newStack.length - MAX_HISTORY_ENTRIES)
  }

  return {
    stack: newStack,
    index: newStack.length - 1,
  }
}

/**
 * A pure function that calculates the next state based on the current state and a dispatched action.
 * This function does not handle derived state, which is calculated by the main `sudokuReducer`.
 * @param state The current `SudokuState`.
 * @param action The `SudokuAction` to process.
 * @returns The new, unprocessed `SudokuState`.
 */
function produceNewState(state: SudokuState, action: SudokuAction): SudokuState {
  // Any action that modifies the board should clear a previous solve-failed state.
  const isBoardModifyingAction = ![
    'UNDO',
    'REDO',
    'SOLVE_START',
    'SOLVE_FAILURE',
    'SET_ACTIVE_CELL',
    'SET_INPUT_MODE',
    'CLEAR_ERROR',
    'SET_HIGHLIGHTED_VALUE',
    'VIEW_SOLVER_STEP',
    'EXIT_VISUALIZATION',
  ].includes(action.type)

  const baseSolverState = isBoardModifyingAction
    ? { ...state.solver, solveFailed: false }
    : state.solver

  switch (action.type) {
    case 'SET_CELL_VALUE': {
      const newBoard = state.board.map((cell) => ({
        value: cell.value,
        candidates: new Set(cell.candidates),
        centers: new Set(cell.centers),
      }))

      newBoard[action.index] = {
        value: action.value,
        candidates: new Set(),
        centers: new Set(),
      }

      const relatedIndices = getRelatedCellIndices(action.index)
      relatedIndices.forEach((relatedIndex) => {
        newBoard[relatedIndex].candidates.delete(action.value)
        newBoard[relatedIndex].centers.delete(action.value)
      })

      const newHistory = updateHistory(state.history, state.board, newBoard)
      if (newHistory === state.history) return state

      return {
        ...state,
        board: newBoard,
        history: newHistory,
        solver: { ...baseSolverState, isSolved: false },
      }
    }

    case 'TOGGLE_PENCIL_MARK': {
      if (state.board[action.index].value !== null) {
        return state
      }

      const newBoard = state.board.map((c) => ({
        value: c.value,
        candidates: new Set(c.candidates),
        centers: new Set(c.centers),
      }))
      const targetCell = newBoard[action.index]

      if (action.mode === 'candidate') {
        targetCell.candidates.has(action.value)
          ? targetCell.candidates.delete(action.value)
          : targetCell.candidates.add(action.value)
      } else if (action.mode === 'center') {
        targetCell.candidates.clear()
        targetCell.centers.has(action.value)
          ? targetCell.centers.delete(action.value)
          : targetCell.centers.add(action.value)
      }

      const newHistory = updateHistory(state.history, state.board, newBoard)

      return {
        ...state,
        board: newBoard,
        history: newHistory,
        solver: baseSolverState,
      }
    }

    case 'ERASE_CELL': {
      const newBoard = state.board.map((cell, i) =>
        i === action.index
          ? {
            value: null,
            candidates: new Set<number>(),
            centers: new Set<number>(),
          }
          : {
            value: cell.value,
            candidates: new Set(cell.candidates),
            centers: new Set(cell.centers),
          },
      )

      const newHistory = updateHistory(state.history, state.board, newBoard)
      if (newHistory === state.history) return state

      return {
        ...state,
        board: newBoard,
        history: newHistory,
        solver: { ...baseSolverState, isSolved: false },
      }
    }

    case 'CLEAR_BOARD': {
      const newBoard = createEmptyBoard()
      if (areBoardsEqual(state.board, newBoard)) {
        return state
      }
      const newHistory = updateHistory(state.history, state.board, newBoard)
      return {
        ...initialState, // Reset to a clean slate
        board: newBoard,
        history: newHistory,
      }
    }

    case 'UNDO': {
      if (state.history.index > 0) {
        const newHistoryIndex = state.history.index - 1
        const newBoard = state.history.stack[newHistoryIndex]
        return {
          ...state,
          history: { ...state.history, index: newHistoryIndex },
          board: newBoard,
          solver: { ...state.solver, isSolved: false, solveFailed: false },
        }
      }
      return state
    }

    case 'REDO': {
      if (state.history.index < state.history.stack.length - 1) {
        const newHistoryIndex = state.history.index + 1
        const newBoard = state.history.stack[newHistoryIndex]
        return {
          ...state,
          history: { ...state.history, index: newHistoryIndex },
          board: newBoard,
        }
      }
      return state
    }

    case 'SOLVE_START':
      return {
        ...state,
        initialBoard: state.board,
        solver: { ...state.solver, isSolving: true },
      }

    case 'SOLVE_SUCCESS': {
      const { steps, solution } = action.result
      if (!solution) {
        return { ...state, solver: { ...state.solver, isSolving: false, solveFailed: true } }
      }

      const boardAfterLogic = state.initialBoard.map((cell) => ({
        ...cell,
      }))

      for (const step of steps) {
        for (const placement of step.placements) {
          boardAfterLogic[placement.index].value = placement.value
        }
      }

      const isSolvedByLogic = boardAfterLogic.every((cell) => cell.value !== null)
      const finalSteps = [...steps]

      if (!isSolvedByLogic) {
        finalSteps.push({
          technique: 'Backtracking',
          placements: [],
          eliminations: [],
          cause: [],
        })
      }

      const solvedBoard: BoardState = solution
        .split('')
        .map((char) => ({
          value: char === '.' ? null : parseInt(char, 10),
          candidates: new Set(),
          centers: new Set(),
        }))

      return {
        ...state,
        board: solvedBoard,
        solver: {
          ...state.solver,
          isSolving: false,
          isSolved: true,
          gameMode: 'visualizing',
          steps: finalSteps,
          currentStepIndex: finalSteps.length,
          visualizationBoard: solvedBoard,
        },
      }
    }

    case 'SOLVE_FAILURE':
      return {
        ...state,
        solver: { ...state.solver, isSolving: false, solveFailed: true },
      }

    case 'VIEW_SOLVER_STEP': {
      if (state.solver.gameMode !== 'visualizing') return state

      const stepIndexToShow = action.index
      const boardBeforeStep = state.initialBoard.map((cell) => ({
        ...cell,
        candidates: new Set<number>(),
      }))
      const candidates = calculateCandidates(state.initialBoard)
      for (let i = 0; i < BOARD_SIZE; i++) {
        boardBeforeStep[i].candidates = candidates[i] ?? new Set()
      }

      for (let i = 0; i < stepIndexToShow - 1; i++) {
        const step = state.solver.steps[i]
        for (const p of step.placements) {
          boardBeforeStep[p.index].value = p.value
          boardBeforeStep[p.index].candidates.clear()
          const peers = getRelatedCellIndices(p.index)
          peers.forEach((peerIdx) => {
            if (peerIdx !== p.index) {
              boardBeforeStep[peerIdx].candidates.delete(p.value)
            }
          })
        }
        for (const e of step.eliminations) {
          boardBeforeStep[e.index].candidates.delete(e.value)
        }
      }

      let boardAfterStep = boardBeforeStep
      let eliminationsForViz: Elimination[] = []

      if (stepIndexToShow > 0) {
        const currentStep = state.solver.steps[stepIndexToShow - 1]
        eliminationsForViz = currentStep.eliminations
        boardAfterStep = boardBeforeStep.map((cell, i) => {
          const placement = currentStep.placements.find((p) => p.index === i)
          return placement
            ? {
              value: placement.value,
              candidates: new Set(),
              centers: new Set(),
            }
            : cell
        })
      }

      if (stepIndexToShow === state.solver.steps.length) {
        boardAfterStep = state.board.map((c) => ({
          value: c.value,
          candidates: new Set(c.candidates),
          centers: new Set(c.centers),
        }))
      }

      const candidatesForViz = boardBeforeStep.map((c) =>
        c.value === null ? c.candidates : null,
      )

      return {
        ...state,
        solver: {
          ...state.solver,
          currentStepIndex: stepIndexToShow,
          visualizationBoard: boardAfterStep,
          candidatesForViz,
          eliminationsForViz,
        },
      }
    }

    case 'EXIT_VISUALIZATION': {
      const restoredBoard = state.initialBoard
      return {
        ...state,
        board: restoredBoard,
        solver: {
          ...initialState.solver,
        },
      }
    }

    case 'SET_ACTIVE_CELL': {
      const newHighlightedValue =
        action.index !== null ? state.board[action.index].value : null
      return {
        ...state,
        ui: {
          ...state.ui,
          activeCellIndex: action.index,
          highlightedValue: newHighlightedValue,
          lastError: null,
        },
      }
    }

    case 'SET_INPUT_MODE':
      return { ...state, ui: { ...state.ui, inputMode: action.mode, lastError: null } }

    case 'CLEAR_ERROR':
      return { ...state, ui: { ...state.ui, lastError: null } }

    case 'SET_HIGHLIGHTED_VALUE':
      return {
        ...state,
        ui: { ...state.ui, highlightedValue: action.value, lastError: null },
      }

    default:
      return state
  }
}

/**
 * The main reducer for the Sudoku game. It wraps the core logic with derived state calculation.
 *
 * @param state - The current state.
 * @param action - The action to perform.
 * @returns The new state.
 */
export function sudokuReducer(
  state: SudokuState,
  action: SudokuAction,
): SudokuState {
  const newState = produceNewState(state, action)

  // If the board instance has changed, recalculate derived state.
  if (newState.board !== state.board) {
    return {
      ...newState,
      derived: getDerivedBoardState(newState.board),
    }
  }

  return newState
}
