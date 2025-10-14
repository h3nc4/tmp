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

// This mock setup uses vi.fn() for the worker constructor, which is more flexible
// for testing different scenarios (e.g., initialization failure).

// A variable to hold the captured message handler from addEventListener
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let messageHandler: (event: any) => void

// The mock instance of the worker with spies for its methods
const mockWorkerInstance = {
  postMessage: vi.fn(),
  addEventListener: vi.fn((_event: string, handler) => {
    // Capture the message handler so we can simulate messages from the worker
    messageHandler = handler
  }),
  removeEventListener: vi.fn(),
  terminate: vi.fn(),
  // Helper for tests to simulate messages FROM the worker
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  __simulateMessage(data: any) {
    if (messageHandler) {
      messageHandler({ data })
    }
  },
}

// Mock the default export of the worker module
vi.mock('@/solver.worker?worker', () => ({
  // We cast the partial mock to 'Worker' to satisfy TypeScript in the editor.
  // This has no effect on the runtime behavior of the passing tests.
  default: vi
    .fn()
    .mockImplementation(() => mockWorkerInstance as unknown as Worker),
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
  const SOLVED_BOARD_ARRAY = SOLVED_BOARD_STRING.split('').map(Number)

  beforeEach(() => {
    vi.clearAllMocks()
    // Restore the default mock implementation before each test
    vi.mocked(SolverWorker).mockImplementation(
      () => mockWorkerInstance as unknown as Worker,
    )
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with an empty board and correct derived state', () => {
    const { result } = renderHook(() => useSudoku())
    expect(result.current.board).toEqual(Array(81).fill(null))
    expect(result.current.isSolving).toBe(false)
    expect(result.current.isSolved).toBe(false)
    expect(result.current.conflicts.size).toBe(0)

    // Check derived state
    expect(result.current.isSolveDisabled).toBe(true)
    expect(result.current.isClearDisabled).toBe(true)
    expect(result.current.solveButtonTitle).toBe('Board is empty.')
    expect(result.current.clearButtonTitle).toBe('Board is already empty.')
  })

  it('should set cell value and update derived state', () => {
    const { result } = renderHook(() => useSudoku())

    act(() => {
      result.current.setCellValue(0, 5)
    })
    expect(result.current.board[0]).toBe(5)
    expect(result.current.conflicts.size).toBe(0)

    // Check derived state
    expect(result.current.isSolveDisabled).toBe(false)
    expect(result.current.isClearDisabled).toBe(false)
    expect(result.current.solveButtonTitle).toBe('Solve the puzzle')
    expect(result.current.clearButtonTitle).toBe('Clear the board')
  })

  it('should update derived state when board has conflicts', () => {
    const { result } = renderHook(() => useSudoku())
    act(() => {
      result.current.setCellValue(0, 5)
      result.current.setCellValue(1, 5) // Row conflict
    })
    expect(result.current.isSolveDisabled).toBe(true)
    expect(result.current.solveButtonTitle).toBe('Cannot solve with conflicts.')
  })

  it('should not set cell value for out-of-bounds index', () => {
    const { result } = renderHook(() => useSudoku())
    const initialBoard = result.current.board
    act(() => {
      result.current.setCellValue(81, 1)
    })
    expect(result.current.board).toEqual(initialBoard)
  })

  it('should clear the board', () => {
    const { result } = renderHook(() => useSudoku())

    act(() => {
      result.current.setCellValue(0, 5)
    })
    expect(result.current.board[0]).toBe(5)

    act(() => {
      result.current.clearBoard()
    })

    expect(result.current.board).toEqual(Array(81).fill(null))
    expect(result.current.conflicts.size).toBe(0)
    expect(toast.info).toHaveBeenCalledWith('Board cleared.')
    expect(result.current.isSolveDisabled).toBe(true) // Should be disabled again
  })

  it('should call the solver and handle a successful solution', async () => {
    const { result } = renderHook(() => useSudoku())

    act(() => {
      result.current.setCellValue(0, 5)
    })

    act(() => {
      result.current.solve()
    })

    expect(result.current.isSolving).toBe(true)
    expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith({
      boardString: '5' + '.'.repeat(80),
    })

    // Simulate a response from the worker
    act(() => {
      mockWorkerInstance.__simulateMessage({
        type: 'solution',
        solution: SOLVED_BOARD_STRING,
      })
    })

    expect(result.current.isSolving).toBe(false)
    expect(result.current.isSolved).toBe(true)
    expect(result.current.board).toEqual(SOLVED_BOARD_ARRAY)
    expect(toast.success).toHaveBeenCalledWith('Sudoku solved successfully!')
    expect(result.current.isSolveDisabled).toBe(true) // Disabled because board is full
    expect(result.current.solveButtonTitle).toBe('Board is already full.')
  })

  it('should handle a solver error and update derived state', async () => {
    const { result } = renderHook(() => useSudoku())
    await waitFor(() => expect(result.current).toBeDefined())

    act(() => {
      result.current.setCellValue(0, 1)
      result.current.solve()
    })
    expect(result.current.isSolving).toBe(true)

    // Simulate an error from the worker
    const errorMessage = 'No solution found'
    act(() => {
      mockWorkerInstance.__simulateMessage({ type: 'error', error: errorMessage })
    })

    expect(result.current.isSolving).toBe(false)
    expect(result.current.isSolved).toBe(false)
    expect(result.current.isSolveDisabled).toBe(true)
    expect(result.current.solveButtonTitle).toBe(
      'Solving failed. Please change the board to try again.',
    )
    expect(toast.error).toHaveBeenCalledWith(`Solving failed: ${errorMessage}`)
  })

  it('should not call solver if there are conflicts', () => {
    const { result } = renderHook(() => useSudoku())

    act(() => {
      result.current.setCellValue(0, 5)
      result.current.setCellValue(1, 5)
    })
    expect(result.current.conflicts.size).toBe(2)

    act(() => {
      result.current.solve()
    })

    expect(result.current.isSolving).toBe(false)
    expect(toast.error).toHaveBeenCalledWith(
      'Cannot solve with conflicts. Please correct the cells.',
    )
  })

  it('should terminate worker on unmount', () => {
    const { unmount } = renderHook(() => useSudoku())
    unmount()
    expect(mockWorkerInstance.terminate).toHaveBeenCalled()
  })

  it('should handle case where worker fails to initialize', () => {
    // Mock the constructor to throw an error for this test only
    vi.mocked(SolverWorker).mockImplementationOnce(() => {
      throw new Error('Worker initialization failed')
    })

    // Thanks to the try/catch block in the hook, this will no longer crash.
    const { result } = renderHook(() => useSudoku())

    // The workerRef will be null. Now, test the public API's guard clause.
    act(() => {
      result.current.solve()
    })

    expect(toast.error).toHaveBeenCalledWith('Solver worker is not available.')
  })
})
