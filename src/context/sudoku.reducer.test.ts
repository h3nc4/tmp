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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  sudokuReducer,
  createEmptyBoard,
  initialState,
  loadInitialState,
} from './sudoku.reducer'
import type { SudokuAction } from './sudoku.actions.types'
import type { BoardState, SudokuState } from './sudoku.types'
import { getRelatedCellIndices } from '@/lib/utils'

describe('sudokuReducer', () => {
  describe('High-Level User Actions', () => {
    describe('INPUT_VALUE', () => {
      it('should set cell value in normal mode and auto-advance', () => {
        const state: SudokuState = { ...initialState, activeCellIndex: 0 }
        const newState = sudokuReducer(state, { type: 'INPUT_VALUE', value: 5 })
        expect(newState.board[0].value).toBe(5)
        expect(newState.activeCellIndex).toBe(1) // Auto-advanced
      })

      it('should toggle a candidate mark in candidate mode', () => {
        const state: SudokuState = {
          ...initialState,
          activeCellIndex: 0,
          inputMode: 'candidate',
        }
        const newState = sudokuReducer(state, { type: 'INPUT_VALUE', value: 3 })
        expect(newState.board[0].candidates.has(3)).toBe(true)
      })

      it('should set lastError if trying to add an invalid pencil mark', () => {
        // Pre-fill a cell that will conflict
        const stateWithConflict = sudokuReducer(initialState, {
          type: 'SET_CELL_VALUE',
          index: 1,
          value: 3,
        })
        const state: SudokuState = {
          ...stateWithConflict,
          activeCellIndex: 0,
          inputMode: 'center',
        }
        const newState = sudokuReducer(state, { type: 'INPUT_VALUE', value: 3 })
        expect(newState.lastError).not.toBeNull()
        expect(newState.board[0].centers.has(3)).toBe(false) // State not changed
      })

      it('should not do anything if no cell is active', () => {
        const state: SudokuState = { ...initialState, activeCellIndex: null }
        const newState = sudokuReducer(state, { type: 'INPUT_VALUE', value: 5 })
        expect(newState).toBe(state) // State remains unchanged
      })

      it('should not auto-advance if move creates a conflict', () => {
        let state = sudokuReducer(initialState, {
          type: 'SET_CELL_VALUE',
          index: 1,
          value: 5,
        })
        state = { ...state, activeCellIndex: 0 }
        const newState = sudokuReducer(state, { type: 'INPUT_VALUE', value: 5 })
        expect(newState.board[0].value).toBe(5)
        expect(newState.activeCellIndex).toBe(0) // Did not advance
      })
    })

    describe('NAVIGATE', () => {
      it.each([
        ['right', 0, 1],
        ['left', 1, 0],
        ['down', 0, 9],
        ['up', 9, 0],
      ])(
        'should navigate %s from %i to %i',
        (direction, startIndex, expectedIndex) => {
          const state: SudokuState = { ...initialState, activeCellIndex: startIndex }
          const action = {
            type: 'NAVIGATE',
            direction,
          } as SudokuAction
          const newState = sudokuReducer(state, action)
          expect(newState.activeCellIndex).toBe(expectedIndex)
        },
      )

      it.each([
        ['right', 80],
        ['left', 0],
        ['down', 72],
        ['up', 8],
      ])('should not navigate %s from boundary cell %i', (direction, index) => {
        const state: SudokuState = { ...initialState, activeCellIndex: index }
        const action = {
          type: 'NAVIGATE',
          direction,
        } as SudokuAction
        const newState = sudokuReducer(state, action)
        expect(newState.activeCellIndex).toBe(index)
      })

      it('should do nothing if no cell is active', () => {
        const state: SudokuState = { ...initialState, activeCellIndex: null }
        const newState = sudokuReducer(state, {
          type: 'NAVIGATE',
          direction: 'right',
        })
        expect(newState).toBe(state)
      })
    })

    describe('ERASE_ACTIVE_CELL', () => {
      it('should erase cell and move left on "backspace"', () => {
        let state: SudokuState = sudokuReducer(initialState, {
          type: 'SET_CELL_VALUE',
          index: 1,
          value: 5,
        })
        state = { ...state, activeCellIndex: 1 }
        const newState = sudokuReducer(state, {
          type: 'ERASE_ACTIVE_CELL',
          mode: 'backspace',
        })
        expect(newState.board[1].value).toBeNull()
        expect(newState.activeCellIndex).toBe(0)
      })

      it('should erase cell and not move on "delete"', () => {
        let state: SudokuState = sudokuReducer(initialState, {
          type: 'SET_CELL_VALUE',
          index: 1,
          value: 5,
        })
        state = { ...state, activeCellIndex: 1 }
        const newState = sudokuReducer(state, {
          type: 'ERASE_ACTIVE_CELL',
          mode: 'delete',
        })
        expect(newState.board[1].value).toBeNull()
        expect(newState.activeCellIndex).toBe(1)
      })

      it('should do nothing if no cell is active', () => {
        const state: SudokuState = { ...initialState, activeCellIndex: null }
        const newState = sudokuReducer(state, {
          type: 'ERASE_ACTIVE_CELL',
          mode: 'delete',
        })
        expect(newState).toBe(state)
      })
    })
  })

  describe('Internal Actions', () => {
    describe('SET_CELL_VALUE', () => {
      it('should set a value, clear own pencil marks, and update history', () => {
        const stateWithPencilMarks: SudokuState = {
          ...initialState,
          board: initialState.board.map((cell, i) =>
            i === 0
              ? { ...cell, candidates: new Set([1, 2]), centers: new Set<number>() }
              : cell,
          ),
        }
        const action: SudokuAction = { type: 'SET_CELL_VALUE', index: 0, value: 5 }
        const newState = sudokuReducer(stateWithPencilMarks, action)

        expect(newState.board[0].value).toBe(5)
        expect(newState.board[0].candidates.size).toBe(0)
        expect(newState.history).toHaveLength(2)
        expect(newState.historyIndex).toBe(1)
        expect(newState.isSolved).toBe(false)
        expect(newState.solveFailed).toBe(false)
      })

      it('should clear related pencil marks (candidates and centers)', () => {
        const state: SudokuState = {
          ...initialState,
          board: initialState.board.map((cell, i) => {
            if (i === 1) return { ...cell, candidates: new Set([5]) }
            if (i === 9) return { ...cell, centers: new Set([5]) }
            return cell
          }),
        }

        const action: SudokuAction = { type: 'SET_CELL_VALUE', index: 0, value: 5 }
        const newState = sudokuReducer(state, action)

        expect(newState.board[0].value).toBe(5)
        const relatedIndices = getRelatedCellIndices(0)
        relatedIndices.forEach((i) => {
          if (i !== 0) {
            expect(newState.board[i].candidates.has(5)).toBe(false)
            expect(newState.board[i].centers.has(5)).toBe(false)
          }
        })
      })

      it('should truncate future history when making a new move', () => {
        let state = sudokuReducer(initialState, {
          type: 'SET_CELL_VALUE',
          index: 0,
          value: 1,
        })
        state = sudokuReducer(state, {
          type: 'SET_CELL_VALUE',
          index: 1,
          value: 2,
        })
        state = sudokuReducer(state, { type: 'UNDO' }) // historyIndex is now 1

        const newState = sudokuReducer(state, {
          type: 'SET_CELL_VALUE',
          index: 2,
          value: 3,
        })
        expect(newState.history).toHaveLength(3) // [empty, {0:1}, {0:1, 2:3}]
        expect(newState.historyIndex).toBe(2)
        expect(newState.board[1].value).toBe(null) // The undone move is gone
      })
    })

    describe('TOGGLE_PENCIL_MARK', () => {
      it('should add a candidate mark', () => {
        const action: SudokuAction = {
          type: 'TOGGLE_PENCIL_MARK',
          index: 0,
          value: 1,
          mode: 'candidate',
        }
        const newState = sudokuReducer(initialState, action)
        expect(newState.board[0].candidates.has(1)).toBe(true)
      })

      it('should remove an existing candidate mark', () => {
        const stateWithMark = sudokuReducer(initialState, {
          type: 'TOGGLE_PENCIL_MARK',
          index: 0,
          value: 1,
          mode: 'candidate',
        })
        const action: SudokuAction = {
          type: 'TOGGLE_PENCIL_MARK',
          index: 0,
          value: 1,
          mode: 'candidate',
        }
        const newState = sudokuReducer(stateWithMark, action)
        expect(newState.board[0].candidates.has(1)).toBe(false)
      })

      it('should clear candidates when adding a center mark', () => {
        const stateWithCandidates = sudokuReducer(initialState, {
          type: 'TOGGLE_PENCIL_MARK',
          index: 0,
          value: 1,
          mode: 'candidate',
        })
        const action: SudokuAction = {
          type: 'TOGGLE_PENCIL_MARK',
          index: 0,
          value: 5,
          mode: 'center',
        }
        const newState = sudokuReducer(stateWithCandidates, action)
        expect(newState.board[0].candidates.size).toBe(0)
        expect(newState.board[0].centers.has(5)).toBe(true)
      })

      it('should remove an existing center mark', () => {
        const stateWithMark = sudokuReducer(initialState, {
          type: 'TOGGLE_PENCIL_MARK',
          index: 0,
          value: 5,
          mode: 'center',
        })
        const action: SudokuAction = {
          type: 'TOGGLE_PENCIL_MARK',
          index: 0,
          value: 5,
          mode: 'center',
        }
        const newState = sudokuReducer(stateWithMark, action)
        expect(newState.board[0].centers.has(5)).toBe(false)
      })
    })

    describe('ERASE_CELL', () => {
      it('should clear value and all pencil marks from a cell', () => {
        const stateWithValue = sudokuReducer(initialState, {
          type: 'SET_CELL_VALUE',
          index: 0,
          value: 5,
        })
        const state: SudokuState = {
          ...stateWithValue,
          board: stateWithValue.board.map((cell, i) =>
            i === 0
              ? { ...cell, candidates: new Set([1]), centers: new Set([2]) }
              : cell,
          ),
        }
        const action: SudokuAction = { type: 'ERASE_CELL', index: 0 }
        const newState = sudokuReducer(state, action)
        expect(newState.board[0].value).toBe(null)
        expect(newState.board[0].candidates.size).toBe(0)
        expect(newState.board[0].centers.size).toBe(0)
        expect(newState.historyIndex).toBe(2)
      })
    })

    describe('CLEAR_BOARD', () => {
      it('should reset the board and active cell', () => {
        let state: SudokuState = sudokuReducer(initialState, {
          type: 'SET_CELL_VALUE',
          index: 0,
          value: 5,
        })
        state = { ...state, activeCellIndex: 0 }
        const action: SudokuAction = { type: 'CLEAR_BOARD' }
        const newState = sudokuReducer(state, action)
        expect(newState.board).toEqual(createEmptyBoard())
        expect(newState.activeCellIndex).toBe(null)
        // History should now be [initial, move, clear]
        expect(newState.history).toHaveLength(3)
        expect(newState.history[2]).toEqual(createEmptyBoard())
      })
    })

    describe('History (UNDO/REDO)', () => {
      const stateWithHistory: SudokuState = {
        ...initialState,
        history: [
          createEmptyBoard(),
          createEmptyBoard().map((c, i) => (i === 0 ? { ...c, value: 1 } : c)),
          createEmptyBoard().map((c, i) => (i === 0 ? { ...c, value: 2 } : c)),
        ],
        historyIndex: 2,
      }

      it('should UNDO to the previous state', () => {
        const newState = sudokuReducer(stateWithHistory, { type: 'UNDO' })
        expect(newState.historyIndex).toBe(1)
        expect(newState.board).toEqual(stateWithHistory.history[1])
        expect(newState.solveFailed).toBe(false) // Can solve again after undo
      })

      it('should not UNDO past the beginning of history', () => {
        const stateAtStart: SudokuState = { ...stateWithHistory, historyIndex: 0 }
        const newState = sudokuReducer(stateAtStart, { type: 'UNDO' })
        expect(newState.historyIndex).toBe(0)
      })

      it('should REDO to the next state', () => {
        const stateInMiddle: SudokuState = { ...stateWithHistory, historyIndex: 1 }
        const newState = sudokuReducer(stateInMiddle, { type: 'REDO' })
        expect(newState.historyIndex).toBe(2)
        expect(newState.board).toEqual(stateWithHistory.history[2])
      })

      it('should not REDO past the end of history', () => {
        const newState = sudokuReducer(stateWithHistory, { type: 'REDO' })
        expect(newState.historyIndex).toBe(2)
      })
    })

    describe('Solver Actions', () => {
      it('should set solving state on SOLVE_START', () => {
        const state = sudokuReducer(initialState, { type: 'SOLVE_START' })
        expect(state.isSolving).toBe(true)
        expect(state.initialBoard).toEqual(initialState.board)
      })

      it('should handle SOLVE_SUCCESS', () => {
        const solvedBoardString = '1'.repeat(81)
        const solvedBoard: BoardState = solvedBoardString
          .split('')
          .map((char) => ({
            value: parseInt(char, 10),
            candidates: new Set(),
            centers: new Set(),
          }))

        const state: SudokuState = { ...initialState, isSolving: true }
        const newState = sudokuReducer(state, {
          type: 'SOLVE_SUCCESS',
          solution: solvedBoard,
        })

        expect(newState.isSolving).toBe(false)
        expect(newState.isSolved).toBe(true)
        expect(newState.board).toEqual(solvedBoard)
        expect(newState.historyIndex).toBe(1)
        expect(newState.history[1]).toEqual(solvedBoard)
      })

      it('should handle SOLVE_FAILURE', () => {
        const state: SudokuState = { ...initialState, isSolving: true }
        const newState = sudokuReducer(state, { type: 'SOLVE_FAILURE' })
        expect(newState.isSolving).toBe(false)
        expect(newState.solveFailed).toBe(true)
      })
    })

    describe('UI Actions', () => {
      it('should set active cell index', () => {
        const newState = sudokuReducer(initialState, {
          type: 'SET_ACTIVE_CELL',
          index: 10,
        })
        expect(newState.activeCellIndex).toBe(10)
      })

      it('should set input mode', () => {
        const newState = sudokuReducer(initialState, {
          type: 'SET_INPUT_MODE',
          mode: 'candidate',
        })
        expect(newState.inputMode).toBe('candidate')
      })

      it('should clear the last error', () => {
        const stateWithError: SudokuState = { ...initialState, lastError: 'Some error' }
        const newState = sudokuReducer(stateWithError, { type: 'CLEAR_ERROR' })
        expect(newState.lastError).toBeNull()
      })
    })

    describe('Derived State and Side Effects', () => {
      it('should update derived state when board changes', () => {
        let state = sudokuReducer(initialState, {
          type: 'SET_CELL_VALUE',
          index: 0,
          value: 5,
        })
        expect(state.isBoardEmpty).toBe(false)
        expect(state.isBoardFull).toBe(false)
        expect(state.conflicts.size).toBe(0)

        state = sudokuReducer(state, { type: 'SET_CELL_VALUE', index: 1, value: 5 })
        expect(state.conflicts.size).toBe(2)
        expect(state.conflicts.has(0)).toBe(true)
        expect(state.conflicts.has(1)).toBe(true)
      })

      it('should reset solveFailed state on any board modifying action', () => {
        let state: SudokuState = { ...initialState, solveFailed: true }
        state = sudokuReducer(state, { type: 'SET_CELL_VALUE', index: 0, value: 1 })
        expect(state.solveFailed).toBe(false)
      })
    })

    describe('Default Case', () => {
      it('should return the same state for an unknown action', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const unknownAction = { type: 'UNKNOWN_ACTION' } as any
        const newState = sudokuReducer(initialState, unknownAction)
        expect(newState).toBe(initialState)
      })
    })
  })
})

describe('loadInitialState', () => {
  const localStorageMock = (() => {
    let store: Record<string, string> = {}
    return {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value.toString()
      }),
      clear: vi.fn(() => {
        store = {}
      }),
      removeItem: vi.fn(),
      length: 0,
      key: vi.fn(),
    }
  })()

  beforeEach(() => {
    localStorageMock.clear()
    vi.spyOn(window, 'localStorage', 'get').mockReturnValue(localStorageMock)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return initial state if localStorage is empty', () => {
    localStorageMock.getItem.mockReturnValue(null)
    const state = loadInitialState()
    expect(state).toEqual(initialState)
  })

  it('should load and parse state with Sets from localStorage', () => {
    const boardWithPencilMarks: BoardState = createEmptyBoard().map((cell, index) =>
      index === 0 ? { ...cell, candidates: new Set([1, 2, 3]) } : cell,
    )
    const savedState = {
      history: [boardWithPencilMarks],
      historyIndex: 0,
    }

    function replacer(_key: string, value: unknown) {
      if (value instanceof Set) {
        return { __dataType: 'Set', value: [...value] }
      }
      return value
    }

    localStorageMock.getItem.mockReturnValue(JSON.stringify(savedState, replacer))
    const state = loadInitialState()

    expect(state.historyIndex).toBe(0)
    expect(state.board[0].candidates).toBeInstanceOf(Set)
    expect(state.board[0].candidates).toEqual(new Set([1, 2, 3]))
    expect(state.board[1].candidates.size).toBe(0)
    expect(state.isBoardEmpty).toBe(true)
  })

  it('should handle JSON parsing errors gracefully', () => {
    localStorageMock.getItem.mockReturnValue('not json')
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { })
    const state = loadInitialState()
    expect(state).toEqual(initialState)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to load game state from local storage:',
      expect.any(Error),
    )
    consoleErrorSpy.mockRestore()
  })

  it('should return initial state for malformed (but valid JSON) data', () => {
    const malformedData = { someOtherKey: 'value' }
    localStorageMock.getItem.mockReturnValue(JSON.stringify(malformedData))
    const state = loadInitialState()
    expect(state).toEqual(initialState)
  })

  it('should return initial state if saved history is empty', () => {
    const malformedData = { history: [], historyIndex: 0 }
    localStorageMock.getItem.mockReturnValue(JSON.stringify(malformedData))
    const state = loadInitialState()
    expect(state).toEqual(initialState)
  })
})
