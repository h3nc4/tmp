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

import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import SolverWorker from '@/solver.worker?worker'
import { useSudoku } from './useSudoku'

// --- Mocks ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let messageHandler: (event: { data: any }) => void

const mockWorkerInstance = {
  postMessage: vi.fn(),
  addEventListener: vi.fn((_event: string, handler) => {
    messageHandler = handler
  }),
  removeEventListener: vi.fn(),
  terminate: vi.fn(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  __simulateMessage(data: any) {
    if (messageHandler) {
      messageHandler({ data })
    }
  },
}

vi.mock('@/solver.worker?worker', () => ({
  default: vi.fn().mockImplementation(() => mockWorkerInstance as unknown as Worker),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

// --- Tests ---

describe('useSudoku hook', () => {
  const SOLVED_BOARD_STRING =
    '534678912672195348198342567859761423426853791713924856961537284287419635345286179'

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(SolverWorker).mockImplementation(() => mockWorkerInstance as unknown as Worker)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with an empty board and correct derived state', () => {
    const { result } = renderHook(() => useSudoku())
    expect(result.current.board.every((c) => c.value === null)).toBe(true)
    expect(result.current.isSolving).toBe(false)
    expect(result.current.isSolved).toBe(false)
    expect(result.current.conflicts.size).toBe(0)
    expect(result.current.isSolveDisabled).toBe(true)
    expect(result.current.isClearDisabled).toBe(true)
    expect(result.current.solveButtonTitle).toBe('Board is empty.')
    expect(result.current.clearButtonTitle).toBe('Board is already empty.')
  })

  it('should terminate worker on unmount', () => {
    const { unmount } = renderHook(() => useSudoku())
    unmount()
    expect(mockWorkerInstance.terminate).toHaveBeenCalled()
  })

  it('should handle case where worker fails to initialize', () => {
    vi.mocked(SolverWorker).mockImplementationOnce(() => {
      throw new Error('Worker initialization failed')
    })
    const { result } = renderHook(() => useSudoku())
    act(() => result.current.solve())
    expect(toast.error).toHaveBeenCalledWith('Solver functionality is unavailable.')
  })

  describe('Board and Cell Manipulation', () => {
    it('should set a cell value and clear its own pencil marks', () => {
      const { result } = renderHook(() => useSudoku())
      act(() => result.current.togglePencilMark(0, 1, 'candidate'))
      act(() => result.current.togglePencilMark(0, 2, 'candidate'))
      expect(result.current.board[0].candidates.size).toBe(2)

      act(() => result.current.setCellValue(0, 5))
      expect(result.current.board[0].value).toBe(5)
      expect(result.current.board[0].candidates.size).toBe(0)
      expect(result.current.board[0].centers.size).toBe(0)
    })

    it('should clear related pencil marks when a value is set', () => {
      const { result } = renderHook(() => useSudoku())
      act(() => result.current.togglePencilMark(1, 5, 'candidate'))
      act(() => result.current.togglePencilMark(9, 5, 'candidate'))
      expect(result.current.board[1].candidates.has(5)).toBe(true)
      expect(result.current.board[9].candidates.has(5)).toBe(true)

      act(() => result.current.setCellValue(0, 5))
      expect(result.current.board[0].value).toBe(5)
      expect(result.current.board[1].candidates.has(5)).toBe(false)
      expect(result.current.board[9].candidates.has(5)).toBe(false)
    })

    it('should do nothing when setCellValue is called with an invalid index', () => {
      const { result } = renderHook(() => useSudoku())
      const initialBoard = result.current.board
      act(() => result.current.setCellValue(-1, 5))
      expect(result.current.board).toBe(initialBoard)
      act(() => result.current.setCellValue(81, 5))
      expect(result.current.board).toBe(initialBoard)
    })

    it('should erase a cell value and its pencil marks', () => {
      const { result } = renderHook(() => useSudoku())
      act(() => result.current.setCellValue(0, 5))
      act(() => result.current.togglePencilMark(1, 3, 'candidate'))
      expect(result.current.board[0].value).toBe(5)

      act(() => result.current.eraseCell(0))
      expect(result.current.board[0].value).toBe(null)
      expect(result.current.board[0].candidates.size).toBe(0)
      expect(result.current.board[1].candidates.has(3)).toBe(true)
    })

    it('should do nothing when eraseCell is called with an invalid index', () => {
      const { result } = renderHook(() => useSudoku())
      const initialBoard = result.current.board
      act(() => result.current.eraseCell(-1))
      expect(result.current.board).toBe(initialBoard)
      act(() => result.current.eraseCell(81))
      expect(result.current.board).toBe(initialBoard)
    })

    it('should clear the entire board and reset state', () => {
      const { result } = renderHook(() => useSudoku())
      act(() => {
        result.current.setCellValue(0, 5)
        result.current.setActiveCellIndex(0)
      })
      expect(result.current.board[0].value).toBe(5)

      act(() => result.current.clearBoard())
      expect(result.current.board.every((c) => c.value === null)).toBe(true)
      expect(result.current.activeCellIndex).toBe(null)
      expect(result.current.conflicts.size).toBe(0)
      expect(toast.info).toHaveBeenCalledWith('Board cleared.')
    })
  })

  describe('Pencil Marks', () => {
    it('should add and remove candidate marks', () => {
      const { result } = renderHook(() => useSudoku())
      act(() => result.current.togglePencilMark(0, 1, 'candidate'))
      expect(result.current.board[0].candidates.has(1)).toBe(true)
      act(() => result.current.togglePencilMark(0, 1, 'candidate'))
      expect(result.current.board[0].candidates.has(1)).toBe(false)
    })

    it('should add and remove center marks', () => {
      const { result } = renderHook(() => useSudoku())
      act(() => result.current.togglePencilMark(0, 1, 'center'))
      expect(result.current.board[0].centers.has(1)).toBe(true)
      act(() => result.current.togglePencilMark(0, 1, 'center'))
      expect(result.current.board[0].centers.has(1)).toBe(false)
    })

    it('should not add marks to a cell with a value', () => {
      const { result } = renderHook(() => useSudoku())
      act(() => result.current.setCellValue(0, 5))
      const boardBefore = result.current.board
      act(() => result.current.togglePencilMark(0, 1, 'candidate'))
      expect(result.current.board).toBe(boardBefore)
    })

    it('should show an error for conflicting pencil marks', () => {
      const { result } = renderHook(() => useSudoku())
      act(() => result.current.setCellValue(1, 5))
      act(() => result.current.togglePencilMark(0, 5, 'candidate'))
      expect(toast.error).toHaveBeenCalledWith('Cannot add pencil mark for 5, it conflicts with a number on the board.')
      expect(result.current.board[0].candidates.has(5)).toBe(false)
    })

    it('should clear candidate marks when adding a center mark', () => {
      const { result } = renderHook(() => useSudoku())
      act(() => result.current.togglePencilMark(0, 1, 'candidate'))
      expect(result.current.board[0].candidates.size).toBe(1)
      act(() => result.current.togglePencilMark(0, 5, 'center'))
      expect(result.current.board[0].candidates.size).toBe(0)
      expect(result.current.board[0].centers.has(5)).toBe(true)
    })

    it('should prevent adding candidate marks if center marks exist', () => {
      const { result } = renderHook(() => useSudoku())
      act(() => result.current.togglePencilMark(0, 5, 'center'))
      const boardBefore = result.current.board
      act(() => result.current.togglePencilMark(0, 1, 'candidate'))
      expect(result.current.board).toBe(boardBefore)
    })
  })

  describe('Undo/Redo', () => {
    it('should undo and redo board changes', () => {
      const { result } = renderHook(() => useSudoku())
      act(() => result.current.setCellValue(0, 1))
      const stateAfterOneMove = result.current.board
      act(() => result.current.setCellValue(1, 2))
      expect(result.current.board[1].value).toBe(2)

      act(() => result.current.undo())
      expect(result.current.board).toEqual(stateAfterOneMove)
      expect(result.current.canRedo).toBe(true)

      act(() => result.current.redo())
      expect(result.current.board[1].value).toBe(2)
      expect(result.current.canRedo).toBe(false)
    })

    it('should not undo/redo past history boundaries', () => {
      const { result } = renderHook(() => useSudoku())
      const initialBoard = result.current.board
      act(() => result.current.setCellValue(0, 1))
      expect(result.current.board).not.toBe(initialBoard)

      act(() => result.current.redo())
      expect(result.current.canRedo).toBe(false)
      expect(result.current.board[0].value).toBe(1)

      act(() => result.current.undo())
      expect(result.current.board).toEqual(initialBoard)
      expect(result.current.canUndo).toBe(false)

      act(() => result.current.undo())
      expect(result.current.board).toEqual(initialBoard)
    })
  })

  describe('Solver Interaction', () => {
    it('should not call solver if there are conflicts', () => {
      const { result } = renderHook(() => useSudoku())
      act(() => result.current.setCellValue(0, 5))
      act(() => result.current.setCellValue(1, 5))
      expect(result.current.conflicts.size).toBe(2)

      act(() => result.current.solve())
      expect(result.current.isSolving).toBe(false)
      expect(toast.error).toHaveBeenCalledWith('Cannot solve with conflicts. Please correct the cells.')
    })

    it('should call the solver and handle a successful solution', async () => {
      const { result } = renderHook(() => useSudoku())
      act(() => result.current.setCellValue(0, 5))
      act(() => result.current.solve())

      expect(result.current.isSolving).toBe(true)
      expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith({ boardString: '5' + '.'.repeat(80) })

      act(() => mockWorkerInstance.__simulateMessage({ type: 'solution', solution: SOLVED_BOARD_STRING }))

      expect(result.current.isSolving).toBe(false)
      expect(result.current.isSolved).toBe(true)
      expect(result.current.board[0].value).toBe(5)
      expect(toast.success).toHaveBeenCalledWith('Sudoku solved successfully!')
    })

    it('should handle a solver error', async () => {
      const { result } = renderHook(() => useSudoku())
      await waitFor(() => expect(result.current).toBeDefined())
      act(() => {
        result.current.setCellValue(0, 1)
        result.current.solve()
      })
      expect(result.current.isSolving).toBe(true)

      const errorMessage = 'No solution found'
      act(() => mockWorkerInstance.__simulateMessage({ type: 'error', error: errorMessage }))

      expect(result.current.isSolving).toBe(false)
      expect(result.current.isSolved).toBe(false)
      expect(result.current.solveFailed).toBe(true)
      expect(toast.error).toHaveBeenCalledWith(`Solving failed: ${errorMessage}`)
    })
  })

  describe('Derived State and Logic', () => {
    it('should update conflicts when board changes', () => {
      const { result } = renderHook(() => useSudoku())
      expect(result.current.conflicts.size).toBe(0)
      act(() => result.current.setCellValue(0, 5))
      expect(result.current.conflicts.size).toBe(0)
      act(() => result.current.setCellValue(1, 5))
      expect(result.current.conflicts).toEqual(new Set([0, 1]))
      act(() => result.current.eraseCell(1))
      expect(result.current.conflicts.size).toBe(0)
    })

    it('should correctly calculate isClearDisabled and clearButtonTitle', () => {
      const { result } = renderHook(() => useSudoku())
      expect(result.current.isClearDisabled).toBe(true)
      expect(result.current.clearButtonTitle).toBe('Board is already empty.')

      act(() => result.current.setCellValue(0, 1))
      expect(result.current.isClearDisabled).toBe(false)
      expect(result.current.clearButtonTitle).toBe('Clear the board')

      act(() => result.current.solve())
      expect(result.current.isSolving).toBe(true)
      expect(result.current.isClearDisabled).toBe(true)
    })

    it('should correctly calculate isSolveDisabled and solveButtonTitle for all states', () => {
      const { result } = renderHook(() => useSudoku())
      expect(result.current.isSolveDisabled).toBe(true)
      expect(result.current.solveButtonTitle).toBe('Board is empty.')

      act(() => result.current.setCellValue(0, 1))
      expect(result.current.isSolveDisabled).toBe(false)
      expect(result.current.solveButtonTitle).toBe('Solve the puzzle')

      act(() => result.current.setCellValue(1, 1))
      expect(result.current.isSolveDisabled).toBe(true)
      expect(result.current.solveButtonTitle).toBe('Cannot solve with conflicts.')

      act(() => result.current.eraseCell(1))
      act(() => result.current.solve())
      act(() => mockWorkerInstance.__simulateMessage({ type: 'error', error: 'failed' }))
      expect(result.current.solveFailed).toBe(true)
      expect(result.current.isSolveDisabled).toBe(true)
      expect(result.current.solveButtonTitle).toBe('Solving failed. Please change the board to try again.')

      act(() => result.current.setCellValue(2, 2))
      expect(result.current.solveFailed).toBe(false)
      expect(result.current.isSolveDisabled).toBe(false)
    })

    it('should update solve button title to "Board is already full" when solved', () => {
      const { result } = renderHook(() => useSudoku())
      act(() => result.current.setCellValue(0, 5))
      act(() => result.current.solve())
      act(() => mockWorkerInstance.__simulateMessage({ type: 'solution', solution: SOLVED_BOARD_STRING }))

      expect(result.current.isSolved).toBe(true)
      expect(result.current.conflicts.size).toBe(0)
      expect(result.current.isSolveDisabled).toBe(true)
      expect(result.current.solveButtonTitle).toBe('Board is already full.')
    })
  })
})
