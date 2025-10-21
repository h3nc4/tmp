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
import type {
  BoardState,
  SudokuState,
  SolvingStep,
  SavedGameState,
} from './sudoku.types'
import { getRelatedCellIndices } from '@/lib/utils'

describe('sudokuReducer', () => {
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
        expect(newState.history.stack).toHaveLength(2)
        expect(newState.history.index).toBe(1)
        expect(newState.solver.isSolved).toBe(false)
        expect(newState.solver.solveFailed).toBe(false)
      })

      it('should return original state if value is already set', () => {
        const stateWithValue = sudokuReducer(initialState, {
          type: 'SET_CELL_VALUE',
          index: 0,
          value: 5,
        })
        const historyLength = stateWithValue.history.stack.length
        const newState = sudokuReducer(stateWithValue, {
          type: 'SET_CELL_VALUE',
          index: 0,
          value: 5,
        })
        expect(newState).toBe(stateWithValue)
        expect(newState.history.stack.length).toBe(historyLength)
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
        state = sudokuReducer(state, { type: 'UNDO' }) // history.index is now 1

        const newState = sudokuReducer(state, {
          type: 'SET_CELL_VALUE',
          index: 2,
          value: 3,
        })
        expect(newState.history.stack).toHaveLength(3) // [empty, {0:1}, {0:1, 2:3}]
        expect(newState.history.index).toBe(2)
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

      it('should not add a pencil mark if the cell has a value', () => {
        const stateWithValue = sudokuReducer(initialState, {
          type: 'SET_CELL_VALUE',
          index: 0,
          value: 5,
        })
        const action: SudokuAction = {
          type: 'TOGGLE_PENCIL_MARK',
          index: 0,
          value: 1,
          mode: 'candidate',
        }
        const newState = sudokuReducer(stateWithValue, action)
        expect(newState).toBe(stateWithValue)
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
        expect(newState.board[0].value).toBeNull()
        expect(newState.board[0].candidates.size).toBe(0)
        expect(newState.board[0].centers.size).toBe(0)
        expect(newState.history.index).toBe(2)
      })

      it('should return original state if cell is already empty', () => {
        const state = sudokuReducer(initialState, { type: 'ERASE_CELL', index: 0 })
        expect(state).toBe(initialState)
        expect(state.history.stack.length).toBe(1)
      })
    })

    describe('CLEAR_BOARD', () => {
      it('should reset the board and ui state', () => {
        let state: SudokuState = sudokuReducer(initialState, {
          type: 'SET_CELL_VALUE',
          index: 0,
          value: 5,
        })
        state = {
          ...state,
          ui: { ...state.ui, activeCellIndex: 0, highlightedValue: 5 },
        }
        const action: SudokuAction = { type: 'CLEAR_BOARD' }
        const newState = sudokuReducer(state, action)
        expect(newState.board).toEqual(createEmptyBoard())
        expect(newState.ui.activeCellIndex).toBe(null)
        expect(newState.ui.highlightedValue).toBe(null)
        // History should now be [initial, move, clear]
        expect(newState.history.stack).toHaveLength(3)
        expect(newState.history.stack[2]).toEqual(createEmptyBoard())
      })

      it('should return original state if board is already empty', () => {
        const state = sudokuReducer(initialState, { type: 'CLEAR_BOARD' })
        expect(state).toBe(initialState)
        expect(state.history.stack.length).toBe(1)
      })

      it('should exit visualization mode when cleared', () => {
        const boardWithValues = initialState.board.map((c) => ({
          ...c,
          value: 1 as number | null,
        }))
        const visualizingState: SudokuState = {
          ...initialState,
          solver: { ...initialState.solver, gameMode: 'visualizing' },
          board: boardWithValues,
          derived: {
            ...initialState.derived,
            isBoardEmpty: false,
          },
        }
        const newState = sudokuReducer(visualizingState, { type: 'CLEAR_BOARD' })
        expect(newState.solver.gameMode).toBe('playing')
        expect(newState.derived.isBoardEmpty).toBe(true)
      })
    })

    describe('History (UNDO/REDO)', () => {
      const stateWithHistory: SudokuState = {
        ...initialState,
        history: {
          stack: [
            createEmptyBoard(),
            createEmptyBoard().map((c, i) => (i === 0 ? { ...c, value: 1 } : c)),
            createEmptyBoard().map((c, i) => (i === 0 ? { ...c, value: 2 } : c)),
          ],
          index: 2,
        },
      }

      it('should UNDO to the previous state', () => {
        const newState = sudokuReducer(stateWithHistory, { type: 'UNDO' })
        expect(newState.history.index).toBe(1)
        expect(newState.board).toEqual(stateWithHistory.history.stack[1])
        expect(newState.solver.solveFailed).toBe(false) // Can solve again after undo
      })

      it('should not UNDO past the beginning of history', () => {
        const stateAtStart: SudokuState = {
          ...stateWithHistory,
          history: { ...stateWithHistory.history, index: 0 },
        }
        const newState = sudokuReducer(stateAtStart, { type: 'UNDO' })
        expect(newState.history.index).toBe(0)
      })

      it('should REDO to the next state', () => {
        const stateInMiddle: SudokuState = {
          ...stateWithHistory,
          history: { ...stateWithHistory.history, index: 1 },
        }
        const newState = sudokuReducer(stateInMiddle, { type: 'REDO' })
        expect(newState.history.index).toBe(2)
        expect(newState.board).toEqual(stateWithHistory.history.stack[2])
      })

      it('should not REDO past the end of history', () => {
        const newState = sudokuReducer(stateWithHistory, { type: 'REDO' })
        expect(newState.history.index).toBe(2)
      })

      it('should prune history when it exceeds the maximum size', () => {
        let state = initialState
        const MAX_HISTORY_ENTRIES = 100 // Should match constant in reducer
        // Loop more than MAX_HISTORY_ENTRIES times, ensuring each action
        // creates a new, unique board state by cycling through values 1-9 in cell 0.
        for (let i = 0; i < MAX_HISTORY_ENTRIES + 5; i++) {
          state = sudokuReducer(state, {
            type: 'SET_CELL_VALUE',
            index: 0, // Always modify the same cell
            value: ((state.board[0].value ?? 0) % 9) + 1 as 1, // Cycle through 1-9
          })
        }
        expect(state.history.stack.length).toBe(MAX_HISTORY_ENTRIES)
        expect(state.history.index).toBe(MAX_HISTORY_ENTRIES - 1)
        // Check that the first entry is no longer the initial empty board
        expect(state.history.stack[0]).not.toEqual(createEmptyBoard())
      })
    })

    describe('Solver Actions', () => {
      it('should set solving state on SOLVE_START', () => {
        const state = sudokuReducer(initialState, { type: 'SOLVE_START' })
        expect(state.solver.isSolving).toBe(true)
        expect(state.initialBoard).toEqual(initialState.board)
      })

      it('should handle SOLVE_SUCCESS', () => {
        const solvedBoardString = '1'.repeat(81)
        const mockResult = {
          steps: [
            {
              technique: 'NakedSingle',
              placements: [{ index: 0, value: 1 }],
              eliminations: [],
              cause: [],
            },
          ],
          solution: solvedBoardString,
        }

        const state: SudokuState = {
          ...initialState,
          solver: { ...initialState.solver, isSolving: true },
          initialBoard: createEmptyBoard().map((c, i) =>
            i === 0 ? c : { ...c, value: (i % 9) + 1 },
          ),
        }
        const newState = sudokuReducer(state, {
          type: 'SOLVE_SUCCESS',
          result: mockResult,
        })

        expect(newState.solver.isSolving).toBe(false)
        expect(newState.solver.isSolved).toBe(true)
        expect(newState.solver.gameMode).toBe('visualizing')
        expect(newState.solver.steps[0]).toEqual(mockResult.steps[0])
        expect(newState.solver.currentStepIndex).toBe(newState.solver.steps.length)
        expect(newState.solver.visualizationBoard?.[0].value).toBe(1)
        expect(newState.board[0].value).toBe(1)
      })

      it('should handle SOLVE_SUCCESS and add a backtracking step if needed', () => {
        const solvedBoardString = '12' + '.'.repeat(79) // A full solution string
        const mockResult = {
          steps: [
            {
              technique: 'NakedSingle',
              placements: [{ index: 0, value: 1 }], // Only one logical step
              eliminations: [],
              cause: [],
            },
          ],
          solution: solvedBoardString,
        }
        const state: SudokuState = {
          ...initialState,
          solver: { ...initialState.solver, isSolving: true },
        }
        const newState = sudokuReducer(state, { type: 'SOLVE_SUCCESS', result: mockResult })

        expect(newState.solver.steps.length).toBe(2)
        expect(newState.solver.steps[1].technique).toBe('Backtracking')
        expect(newState.solver.currentStepIndex).toBe(2)
      })

      it('should handle SOLVE_SUCCESS with no solution string', () => {
        const state: SudokuState = {
          ...initialState,
          solver: { ...initialState.solver, isSolving: true },
        }
        const newState = sudokuReducer(state, {
          type: 'SOLVE_SUCCESS',
          result: { steps: [], solution: null },
        })
        expect(newState.solver.isSolving).toBe(false)
        expect(newState.solver.solveFailed).toBe(true)
      })

      it('should handle SOLVE_FAILURE', () => {
        const state: SudokuState = {
          ...initialState,
          solver: { ...initialState.solver, isSolving: true },
        }
        const newState = sudokuReducer(state, { type: 'SOLVE_FAILURE' })
        expect(newState.solver.isSolving).toBe(false)
        expect(newState.solver.solveFailed).toBe(true)
      })
    })

    describe('Visualization Actions', () => {
      const steps: SolvingStep[] = [
        {
          technique: 'NakedSingle',
          placements: [{ index: 0, value: 1 }],
          eliminations: [
            { index: 1, value: 1 },
            { index: 9, value: 1 },
            { index: 10, value: 1 },
          ],
          cause: [],
        },
        {
          technique: 'HiddenSingle',
          placements: [{ index: 2, value: 3 }],
          eliminations: [
            { index: 2, value: 4 },
            { index: 11, value: 3 },
          ],
          cause: [],
        },
      ]
      const initialBoard = createEmptyBoard().map((c, i) =>
        i === 80 ? { ...c, value: 9 } : c,
      )
      // This represents the final solved board state.
      const solvedBoardForTest = createEmptyBoard().map((c, i) => {
        if (i === 0) return { ...c, value: 1 }
        if (i === 2) return { ...c, value: 3 }
        if (i === 80) return { ...c, value: 9 }
        return c
      })

      const visualizingState: SudokuState = {
        ...initialState,
        initialBoard,
        board: solvedBoardForTest, // The `board` property holds the solution
        solver: {
          ...initialState.solver,
          gameMode: 'visualizing',
          steps,
        },
      }

      it('should handle VIEW_SOLVER_STEP correctly, applying previous steps and calculating candidates', () => {
        // View the second step (index 2)
        const state = sudokuReducer(visualizingState, {
          type: 'VIEW_SOLVER_STEP',
          index: 2,
        })

        expect(state.solver.currentStepIndex).toBe(2)

        // --- Check the visualization board (state AFTER step 2 placements) ---
        expect(state.solver.visualizationBoard).not.toBeNull()
        // Placement from step 1 should be applied
        expect(state.solver.visualizationBoard?.[0].value).toBe(1)
        // Placement from step 2 should be applied
        expect(state.solver.visualizationBoard?.[2].value).toBe(3)
        // Initial value should persist
        expect(state.solver.visualizationBoard?.[80].value).toBe(9)
        // Other cells should be null
        expect(state.solver.visualizationBoard?.[1].value).toBeNull()

        // --- Check the candidates (state BEFORE step 2) ---
        expect(state.solver.candidatesForViz).not.toBeNull()
        // The cell for step 1's placement should have no candidates
        expect(state.solver.candidatesForViz?.[0]).toBeNull()
        // A peer of step 1's placement (e.g., cell 1) should not have 1 as a candidate
        expect(state.solver.candidatesForViz?.[1]?.has(1)).toBe(false)
        // The cell for step 2's placement (cell 2) should still have candidates from before the step was applied
        expect(state.solver.candidatesForViz?.[2]?.has(3)).toBe(true)
        expect(state.solver.candidatesForViz?.[2]?.has(4)).toBe(true) // one of the eliminations for this step

        // --- Check the eliminations (from step 2 itself) ---
        expect(state.solver.eliminationsForViz).not.toBeNull()
        expect(state.solver.eliminationsForViz).toEqual(steps[1].eliminations)
      })

      it('should handle VIEW_SOLVER_STEP for the initial state (index 0)', () => {
        const state = sudokuReducer(visualizingState, {
          type: 'VIEW_SOLVER_STEP',
          index: 0,
        })

        expect(state.solver.currentStepIndex).toBe(0)
        // Board should be the initial board
        expect(state.solver.visualizationBoard?.[80].value).toBe(9)
        expect(state.solver.visualizationBoard?.[0].value).toBeNull()
        // No eliminations to show for the initial state
        expect(state.solver.eliminationsForViz).toEqual([])
        // Candidates should be the initial candidates
        expect(state.solver.candidatesForViz?.[0]?.size).toBeGreaterThan(1)
      })

      it('should show the final solved board when viewing the last step after backtracking', () => {
        // Setup a state where the solver used logic then backtracked
        const logicalStep: SolvingStep = {
          technique: 'NakedSingle',
          placements: [{ index: 0, value: 1 }],
          eliminations: [],
          cause: [],
        }
        const backtrackingStep: SolvingStep = {
          technique: 'Backtracking',
          placements: [],
          eliminations: [],
          cause: [],
        }
        const solvedBoard = createEmptyBoard().map((c, i) => ({
          ...c,
          value: (i % 9) + 1,
        })) // A fake solved board

        const visualizingStateWithBacktrack: SudokuState = {
          ...visualizingState,
          board: solvedBoard, // The real solution
          solver: {
            ...visualizingState.solver,
            steps: [logicalStep, backtrackingStep],
          },
        }

        // 1. View the first logical step
        const stateAfterStep1 = sudokuReducer(visualizingStateWithBacktrack, {
          type: 'VIEW_SOLVER_STEP',
          index: 1, // View step 1
        })

        // The visualization board should only have the first placement
        expect(stateAfterStep1.solver.visualizationBoard?.[0].value).toBe(1)
        expect(stateAfterStep1.solver.visualizationBoard?.[1].value).toBeNull()

        // 2. Now, view the solution (step index 2)
        const stateAfterFinalStep = sudokuReducer(stateAfterStep1, {
          type: 'VIEW_SOLVER_STEP',
          index: 2, // View final step
        })

        // The visualization board should now be the fully solved board
        expect(stateAfterFinalStep.solver.visualizationBoard).toEqual(solvedBoard)
        expect(stateAfterFinalStep.solver.currentStepIndex).toBe(2)
      })

      it('should do nothing if not in visualizing mode', () => {
        const state: SudokuState = {
          ...initialState,
          solver: { ...initialState.solver, gameMode: 'playing' },
        }
        const newState = sudokuReducer(state, {
          type: 'VIEW_SOLVER_STEP',
          index: 1,
        })
        expect(newState).toBe(state)
      })

      it('should handle EXIT_VISUALIZATION', () => {
        const state = sudokuReducer(visualizingState, { type: 'EXIT_VISUALIZATION' })
        expect(state.solver.gameMode).toBe('playing')
        expect(state.board).toEqual(initialBoard)
        expect(state.solver.isSolved).toBe(false)
        expect(state.solver.steps).toEqual([])
        expect(state.solver.currentStepIndex).toBeNull()
        expect(state.solver.visualizationBoard).toBeNull()
        expect(state.solver.candidatesForViz).toBeNull()
        expect(state.solver.eliminationsForViz).toBeNull()
      })
    })

    describe('UI Actions', () => {
      it('should set active cell index and highlighted value', () => {
        let stateWithValue = sudokuReducer(initialState, {
          type: 'SET_CELL_VALUE',
          index: 10,
          value: 7,
        })
        stateWithValue = {
          ...stateWithValue,
          ui: { ...stateWithValue.ui, highlightedValue: null },
        } // reset highlight

        const newState = sudokuReducer(stateWithValue, {
          type: 'SET_ACTIVE_CELL',
          index: 10,
        })
        expect(newState.ui.activeCellIndex).toBe(10)
        expect(newState.ui.highlightedValue).toBe(7)
      })

      it('should set active cell to null and clear highlighted value', () => {
        const stateWithActiveCell: SudokuState = {
          ...initialState,
          ui: { ...initialState.ui, activeCellIndex: 10, highlightedValue: 7 },
        }
        const newState = sudokuReducer(stateWithActiveCell, {
          type: 'SET_ACTIVE_CELL',
          index: null,
        })
        expect(newState.ui.activeCellIndex).toBe(null)
        expect(newState.ui.highlightedValue).toBe(null)
      })

      it('should set input mode', () => {
        const newState = sudokuReducer(initialState, {
          type: 'SET_INPUT_MODE',
          mode: 'candidate',
        })
        expect(newState.ui.inputMode).toBe('candidate')
      })

      it('should clear the last error', () => {
        const stateWithError: SudokuState = {
          ...initialState,
          ui: { ...initialState.ui, lastError: 'Some error' },
        }
        const newState = sudokuReducer(stateWithError, { type: 'CLEAR_ERROR' })
        expect(newState.ui.lastError).toBeNull()
      })

      it('should set the highlighted value', () => {
        const newState = sudokuReducer(initialState, {
          type: 'SET_HIGHLIGHTED_VALUE',
          value: 5,
        })
        expect(newState.ui.highlightedValue).toBe(5)
      })
    })

    describe('Derived State and Side Effects', () => {
      it('should update derived state when board changes', () => {
        let state = sudokuReducer(initialState, {
          type: 'SET_CELL_VALUE',
          index: 0,
          value: 5,
        })
        expect(state.derived.isBoardEmpty).toBe(false)
        expect(state.derived.isBoardFull).toBe(false)
        expect(state.derived.conflicts.size).toBe(0)

        state = sudokuReducer(state, { type: 'SET_CELL_VALUE', index: 1, value: 5 })
        expect(state.derived.conflicts.size).toBe(2)
        expect(state.derived.conflicts.has(0)).toBe(true)
        expect(state.derived.conflicts.has(1)).toBe(true)
      })

      it('should reset solveFailed state on any board modifying action', () => {
        let state: SudokuState = {
          ...initialState,
          solver: { ...initialState.solver, solveFailed: true },
        }
        state = sudokuReducer(state, { type: 'SET_CELL_VALUE', index: 0, value: 1 })
        expect(state.solver.solveFailed).toBe(false)
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
    const savedState: SavedGameState = {
      history: {
        stack: [boardWithPencilMarks],
        index: 0,
      },
    }

    function replacer(_key: string, value: unknown) {
      if (value instanceof Set) {
        return { __dataType: 'Set', value: [...value] }
      }
      return value
    }

    localStorageMock.getItem.mockReturnValue(JSON.stringify(savedState, replacer))
    const state = loadInitialState()

    expect(state.history.index).toBe(0)
    expect(state.board[0].candidates).toBeInstanceOf(Set)
    expect(state.board[0].candidates).toEqual(new Set([1, 2, 3]))
    expect(state.board[1].candidates.size).toBe(0)
    expect(state.derived.isBoardEmpty).toBe(true) // no .value properties were set
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

  it('should return initial state if saved history stack is empty', () => {
    const malformedData: SavedGameState = { history: { stack: [], index: 0 } }
    localStorageMock.getItem.mockReturnValue(JSON.stringify(malformedData))
    const state = loadInitialState()
    expect(state).toEqual(initialState)
  })
})
