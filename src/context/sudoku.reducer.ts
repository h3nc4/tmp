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
  history: [createEmptyBoard()],
  historyIndex: 0,
  isSolving: false,
  isSolved: false,
  solveFailed: false,
  activeCellIndex: null,
  highlightedValue: null,
  inputMode: 'normal',
  lastError: null,
  gameMode: 'playing',
  solverSteps: [],
  currentStepIndex: null,
  visualizationBoard: null,
  candidatesForViz: null,
  eliminationsForViz: null,
  ...getDerivedBoardState(createEmptyBoard()),
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
        savedState &&
        Array.isArray(savedState.history) &&
        typeof savedState.historyIndex === 'number' &&
        savedState.history.length > 0
      ) {
        const currentBoard = savedState.history[savedState.historyIndex]
        return {
          ...initialState,
          history: savedState.history,
          historyIndex: savedState.historyIndex,
          board: currentBoard,
          ...getDerivedBoardState(currentBoard),
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
 * @param state The current `SudokuState`.
 * @param newBoard The `BoardState` to be added to the history.
 * @returns An object with the updated `history` and `historyIndex`.
 */
function updateHistory(
  state: SudokuState,
  newBoard: BoardState,
): {
  history: readonly BoardState[]
  historyIndex: number
} {
  if (areBoardsEqual(state.board, newBoard)) {
    return { history: state.history, historyIndex: state.historyIndex }
  }

  let newHistory = state.history.slice(0, state.historyIndex + 1)
  newHistory.push(newBoard)

  if (newHistory.length > MAX_HISTORY_ENTRIES) {
    // Prune the oldest entry to keep the history size manageable.
    newHistory = newHistory.slice(newHistory.length - MAX_HISTORY_ENTRIES)
  }

  return {
    history: newHistory,
    historyIndex: newHistory.length - 1,
  }
}

/**
 * A pure function that handles all state transitions for the Sudoku game.
 *
 * @param state - The current state.
 * @param action - The action to perform.
 * @returns The new state.
 */
export function sudokuReducer(
  state: SudokuState,
  action: SudokuAction,
): SudokuState {
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

  const baseState = {
    ...state,
    lastError: null, // Clear errors on any new action
    solveFailed: isBoardModifyingAction ? false : state.solveFailed,
  }

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

      const historyUpdate = updateHistory(state, newBoard)
      if (historyUpdate.history === state.history) return state

      return {
        ...baseState,
        board: newBoard,
        ...historyUpdate,
        isSolved: false,
        ...getDerivedBoardState(newBoard),
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

      const historyUpdate = updateHistory(state, newBoard)

      return {
        ...baseState,
        board: newBoard,
        ...historyUpdate,
        ...getDerivedBoardState(newBoard),
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

      const historyUpdate = updateHistory(state, newBoard)
      if (historyUpdate.history === state.history) return state

      return {
        ...baseState,
        board: newBoard,
        ...historyUpdate,
        isSolved: false,
        ...getDerivedBoardState(newBoard),
      }
    }

    case 'CLEAR_BOARD': {
      const newBoard = createEmptyBoard()
      if (areBoardsEqual(state.board, newBoard)) {
        return state
      }

      const historyUpdate = updateHistory(state, newBoard)

      return {
        ...initialState, // Reset to a clean slate
        board: newBoard,
        history: historyUpdate.history,
        historyIndex: historyUpdate.historyIndex,
      }
    }

    case 'UNDO': {
      if (state.historyIndex > 0) {
        const newHistoryIndex = state.historyIndex - 1
        const newBoard = state.history[newHistoryIndex]
        return {
          ...baseState,
          historyIndex: newHistoryIndex,
          board: newBoard,
          isSolved: false,
          solveFailed: false, // Can try solving again after undo
          ...getDerivedBoardState(newBoard),
        }
      }
      return state
    }

    case 'REDO': {
      if (state.historyIndex < state.history.length - 1) {
        const newHistoryIndex = state.historyIndex + 1
        const newBoard = state.history[newHistoryIndex]
        return {
          ...baseState,
          historyIndex: newHistoryIndex,
          board: newBoard,
          ...getDerivedBoardState(newBoard),
        }
      }
      return state
    }

    case 'SOLVE_START':
      return {
        ...baseState,
        isSolving: true,
        initialBoard: state.board,
      }

    case 'SOLVE_SUCCESS': {
      const { steps, solution } = action.result
      if (!solution) {
        return { ...state, isSolving: false, solveFailed: true }
      }

      // Create a mutable copy of the initial board to simulate the logical solve
      const boardAfterLogic = state.initialBoard.map((cell) => ({
        ...cell,
      }))

      // Apply only placements from logical steps
      for (const step of steps) {
        for (const placement of step.placements) {
          boardAfterLogic[placement.index].value = placement.value
        }
      }

      const isSolvedByLogic = boardAfterLogic.every((cell) => cell.value !== null)
      const finalSteps = [...steps]

      // If logic didn't solve it, add a synthetic backtracking step
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
        ...baseState,
        board: solvedBoard, // Show solution on main board
        isSolving: false,
        isSolved: true,
        gameMode: 'visualizing',
        solverSteps: finalSteps,
        currentStepIndex: finalSteps.length, // Select last step (final state)
        visualizationBoard: solvedBoard, // Show final state in viz
        ...getDerivedBoardState(solvedBoard),
      }
    }

    case 'SOLVE_FAILURE':
      return {
        ...state,
        isSolving: false,
        solveFailed: true,
      }

    case 'VIEW_SOLVER_STEP': {
      if (state.gameMode !== 'visualizing') return state

      const stepIndexToShow = action.index

      // Calculate the board state and candidates *before* the target step
      const boardBeforeStep = state.initialBoard.map((cell) => ({
        ...cell,
        candidates: new Set<number>(),
      }))
      const candidates = calculateCandidates(state.initialBoard)
      for (let i = 0; i < BOARD_SIZE; i++) {
        boardBeforeStep[i].candidates = candidates[i] ?? new Set()
      }

      // Apply all steps UP TO the one we are viewing
      for (let i = 0; i < stepIndexToShow - 1; i++) {
        const step = state.solverSteps[i]
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
        const currentStep = state.solverSteps[stepIndexToShow - 1]
        eliminationsForViz = currentStep.eliminations

        // Create the board state *after* the current step's placements
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

      if (stepIndexToShow === state.solverSteps.length) {
        // When viewing the final step/solution, always use the definitive solved board.
        // This correctly handles cases where the final step was backtracking, which
        // has no placements of its own. We create a mutable copy to satisfy TypeScript.
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
        ...baseState,
        currentStepIndex: stepIndexToShow,
        visualizationBoard: boardAfterStep,
        candidatesForViz,
        eliminationsForViz,
      }
    }

    case 'EXIT_VISUALIZATION': {
      const restoredBoard = state.initialBoard
      return {
        ...baseState,
        board: restoredBoard, // Restore the pre-solve board state
        gameMode: 'playing',
        solverSteps: [],
        currentStepIndex: null,
        visualizationBoard: null,
        candidatesForViz: null,
        eliminationsForViz: null,
        isSolved: false, // Exiting means we are no longer in a "solved" state
        ...getDerivedBoardState(restoredBoard),
      }
    }

    case 'SET_ACTIVE_CELL': {
      const newHighlightedValue =
        action.index !== null ? state.board[action.index].value : null
      return {
        ...baseState,
        activeCellIndex: action.index,
        highlightedValue: newHighlightedValue,
      }
    }

    case 'SET_INPUT_MODE':
      return { ...baseState, inputMode: action.mode }

    case 'CLEAR_ERROR':
      return { ...state, lastError: null }

    case 'SET_HIGHLIGHTED_VALUE':
      return { ...baseState, highlightedValue: action.value }

    default:
      return state
  }
}
