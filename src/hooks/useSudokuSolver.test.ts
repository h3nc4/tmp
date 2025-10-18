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

import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { toast } from 'sonner'
import { useSudokuSolver } from './useSudokuSolver'
import SolverWorker from '@/workers/sudoku.worker?worker'
import type { SudokuState, SolveResult } from '@/context/sudoku.types'
import { initialState } from '@/context/sudoku.reducer'

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
  dispatchEvent: vi.fn(),
  onerror: null,
  onmessage: null,
  onmessageerror: null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  __simulateMessage(data: any) {
    if (messageHandler) {
      messageHandler({ data })
    }
  },
}

vi.mock('@/workers/sudoku.worker?worker', () => ({
  default: vi.fn(() => mockWorkerInstance),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('useSudokuSolver', () => {
  const mockDispatch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(SolverWorker)
      .mockClear()
      .mockImplementation(() => mockWorkerInstance as unknown as Worker)
  })

  afterEach(() => {
    // This is important to ensure the worker instance is fresh for each test
    vi.clearAllMocks()
  })

  it('should initialize and terminate the worker on mount/unmount', () => {
    const { unmount } = renderHook(() =>
      useSudokuSolver(initialState, mockDispatch),
    )
    expect(SolverWorker).toHaveBeenCalledOnce()
    expect(mockWorkerInstance.addEventListener).toHaveBeenCalledWith(
      'message',
      expect.any(Function),
    )

    unmount()
    expect(mockWorkerInstance.terminate).toHaveBeenCalledOnce()
  })

  it('should post a message to the worker when isSolving becomes true', () => {
    const solvingState: SudokuState = { ...initialState, isSolving: true }
    const { rerender } = renderHook(
      (props) => useSudokuSolver(props.state, props.dispatch),
      { initialProps: { state: initialState, dispatch: mockDispatch } },
    )

    expect(mockWorkerInstance.postMessage).not.toHaveBeenCalled()

    rerender({ state: solvingState, dispatch: mockDispatch })

    expect(mockWorkerInstance.postMessage).toHaveBeenCalledOnce()
    const expectedBoardString = '.'.repeat(81)
    expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith({
      boardString: expectedBoardString,
    })
  })

  it('should not post a message if not solving', () => {
    renderHook(() => useSudokuSolver(initialState, mockDispatch))
    expect(mockWorkerInstance.postMessage).not.toHaveBeenCalled()
  })

  it('should dispatch SOLVE_SUCCESS on receiving a solution message', () => {
    renderHook(() => useSudokuSolver(initialState, mockDispatch))

    const mockResult: SolveResult = {
      steps: [],
      solution: '1'.repeat(81),
    }

    mockWorkerInstance.__simulateMessage({
      type: 'solution',
      result: mockResult,
    })

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SOLVE_SUCCESS',
      result: mockResult,
    })
    expect(toast.success).toHaveBeenCalledWith('Sudoku solved successfully!')
  })

  it('should do nothing if solution message is missing result object', () => {
    renderHook(() => useSudokuSolver(initialState, mockDispatch))
    mockWorkerInstance.__simulateMessage({ type: 'solution' }) // No result object
    expect(mockDispatch).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('should dispatch SOLVE_FAILURE on receiving an error message', () => {
    renderHook(() => useSudokuSolver(initialState, mockDispatch))
    const errorMessage = 'No solution found'
    mockWorkerInstance.__simulateMessage({ type: 'error', error: errorMessage })
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'SOLVE_FAILURE' })
    expect(toast.error).toHaveBeenCalledWith(`Solving failed: ${errorMessage}`)
  })

  it('should do nothing if error message is missing error string', () => {
    renderHook(() => useSudokuSolver(initialState, mockDispatch))
    mockWorkerInstance.__simulateMessage({ type: 'error' }) // No error string
    expect(mockDispatch).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('should handle worker initialization failure', () => {
    vi.mocked(SolverWorker).mockImplementationOnce(() => {
      throw new Error('Worker failed')
    })

    renderHook(() => useSudokuSolver(initialState, mockDispatch))

    expect(toast.error).toHaveBeenCalledWith(
      'Solver functionality is unavailable.',
    )
  })

  it('should handle case where worker is not available when solving starts', () => {
    // 1. Mock the Worker constructor to throw an error during initialization.
    vi.mocked(SolverWorker).mockImplementationOnce(() => {
      throw new Error('Worker instantiation failed')
    })

    // 2. Render the hook. The first useEffect will run and fail.
    const { rerender } = renderHook(
      (props) => useSudokuSolver(props.state, props.dispatch),
      { initialProps: { state: initialState, dispatch: mockDispatch } },
    )

    // Check that the initialization failure was caught and reported.
    expect(toast.error).toHaveBeenCalledWith(
      'Solver functionality is unavailable.',
    )

    // 3. Now, simulate the user trying to solve.
    const solvingState: SudokuState = { ...initialState, isSolving: true }
    rerender({ state: solvingState, dispatch: mockDispatch })

    // 4. The second useEffect should now run, see that the workerRef is null, and report the error.
    expect(toast.error).toHaveBeenCalledWith('Solver worker is not available.')
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'SOLVE_FAILURE' })
  })
})
