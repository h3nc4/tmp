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
import type { BoardState, SudokuState, SavedGameState } from './sudoku.types'
import {
  getRelatedCellIndices,
  validateBoard,
  isMoveValid,
  areBoardsEqual,
} from '@/lib/utils'

const BOARD_SIZE = 81
const LOCAL_STORAGE_KEY = 'wasudoku-game-state'

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
  ].includes(action.type)

  const baseState = {
    ...state,
    lastError: null, // Clear errors on any new action
    solveFailed: isBoardModifyingAction ? false : state.solveFailed,
  }

  switch (action.type) {
    case 'INPUT_VALUE': {
      if (state.activeCellIndex === null) return state
      const { value } = action

      if (state.inputMode === 'normal') {
        const nextState = sudokuReducer(baseState, {
          type: 'SET_CELL_VALUE',
          index: state.activeCellIndex,
          value,
        })
        // Auto-advance focus if the move was valid and changed the board state
        if (
          nextState !== state && // Check if the state actually changed
          isMoveValid(state.board, state.activeCellIndex, value) &&
          state.activeCellIndex < 80
        ) {
          return { ...nextState, activeCellIndex: state.activeCellIndex + 1 }
        }
        return nextState
      }
      // Handle pencil mark modes
      if (!isMoveValid(state.board, state.activeCellIndex, value)) {
        return {
          ...state,
          lastError: `Cannot add pencil mark for ${value}, it conflicts with a number on the board.`,
        }
      }
      return sudokuReducer(baseState, {
        type: 'TOGGLE_PENCIL_MARK',
        index: state.activeCellIndex,
        value,
        mode: state.inputMode,
      })
    }

    case 'NAVIGATE': {
      if (state.activeCellIndex === null) return state
      let nextIndex = -1
      const { activeCellIndex } = state
      const { direction } = action

      if (direction === 'right' && activeCellIndex < 80) nextIndex = activeCellIndex + 1
      else if (direction === 'left' && activeCellIndex > 0) nextIndex = activeCellIndex - 1
      else if (direction === 'down' && activeCellIndex < 72) nextIndex = activeCellIndex + 9
      else if (direction === 'up' && activeCellIndex > 8) nextIndex = activeCellIndex - 9

      return nextIndex !== -1 ? { ...baseState, activeCellIndex: nextIndex } : state
    }

    case 'ERASE_ACTIVE_CELL': {
      if (state.activeCellIndex === null) return state
      const nextState = sudokuReducer(baseState, {
        type: 'ERASE_CELL',
        index: state.activeCellIndex,
      })

      if (action.mode === 'backspace' && state.activeCellIndex > 0) {
        return { ...nextState, activeCellIndex: state.activeCellIndex - 1 }
      }
      return nextState
    }

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

      if (areBoardsEqual(state.board, newBoard)) {
        return state
      }

      const newHistory = state.history.slice(0, state.historyIndex + 1)
      newHistory.push(newBoard)

      return {
        ...baseState,
        board: newBoard,
        history: newHistory,
        historyIndex: newHistory.length - 1,
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

      const newHistory = state.history.slice(0, state.historyIndex + 1)
      newHistory.push(newBoard)

      return {
        ...baseState,
        board: newBoard,
        history: newHistory,
        historyIndex: newHistory.length - 1,
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

      if (areBoardsEqual(state.board, newBoard)) {
        return state
      }

      const newHistory = state.history.slice(0, state.historyIndex + 1)
      newHistory.push(newBoard)

      return {
        ...baseState,
        board: newBoard,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        isSolved: false,
        ...getDerivedBoardState(newBoard),
      }
    }

    case 'CLEAR_BOARD': {
      const newBoard = createEmptyBoard()
      if (areBoardsEqual(state.board, newBoard)) {
        return state
      }

      const newHistory = [
        ...state.history.slice(0, state.historyIndex + 1),
        newBoard,
      ]

      return {
        ...baseState,
        board: newBoard,
        initialBoard: createEmptyBoard(),
        history: newHistory,
        historyIndex: state.historyIndex + 1,
        isSolved: false,
        activeCellIndex: null,
        highlightedValue: null,
        ...getDerivedBoardState(newBoard),
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
      const newBoard = action.solution
      const newHistory = [
        ...state.history.slice(0, state.historyIndex + 1),
        newBoard,
      ]
      return {
        ...baseState,
        board: newBoard,
        history: newHistory,
        historyIndex: state.historyIndex + 1,
        isSolving: false,
        isSolved: true,
        ...getDerivedBoardState(newBoard),
      }
    }

    case 'SOLVE_FAILURE':
      return {
        ...state,
        isSolving: false,
        solveFailed: true,
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
