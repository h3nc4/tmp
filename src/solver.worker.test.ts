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

import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the entire wasudoku-wasm module before any imports
vi.mock('wasudoku-wasm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('wasudoku-wasm')>()
  return {
    ...actual,
    default: vi.fn().mockResolvedValue({}), // Mock the init() promise
    solve_sudoku: vi.fn(),
  }
})

// Import mocks after they are defined, so we can use vi.mocked()
const { default: init, solve_sudoku } = await import('wasudoku-wasm')

describe('Solver Worker', () => {
  const mockPostMessage = vi.fn()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let messageHandler: ((event: MessageEvent<any>) => void) | null = null

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules() // This is crucial for isolating module state between tests
    messageHandler = null

    // Mock the global worker context
    vi.stubGlobal('self', {
      postMessage: mockPostMessage,
      addEventListener: vi.fn((event, handler) => {
        if (event === 'message') {
          messageHandler = handler as (event: MessageEvent) => void
        }
      }),
      removeEventListener: vi.fn(),
    })

    // Dynamically import the worker script to re-evaluate it with mocks
    await import('@/solver.worker.ts')

    // Wait until the worker's script has run and attached its message handler
    await vi.waitFor(() => {
      if (!messageHandler) {
        throw new Error('Message handler not yet attached by worker')
      }
    })
  })

  // Helper to simulate a message being sent *to* the worker
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const simulateMessage = (data: any) => {
    if (!messageHandler) {
      // This should not be reached due to the waitFor in beforeEach
      throw new Error('Worker message handler not registered')
    }
    messageHandler({ data } as MessageEvent)
  }

  it('should initialize WASM and solve a puzzle successfully', async () => {
    const boardString = '.'.repeat(81)
    const solution = '1'.repeat(81)
    vi.mocked(solve_sudoku).mockReturnValue(solution)

    simulateMessage({ boardString })

    // Wait for async operations within the worker to complete and assertions to pass
    await vi.waitFor(() => {
      expect(init).toHaveBeenCalled()
      expect(solve_sudoku).toHaveBeenCalledWith(boardString)
      expect(mockPostMessage).toHaveBeenCalledWith({
        type: 'solution',
        solution,
      })
    })
  })

  it('should handle solver errors and post an error message', async () => {
    const boardString = 'invalid'
    const errorMessage = 'No solution found'
    vi.mocked(solve_sudoku).mockImplementation(() => {
      throw new Error(errorMessage)
    })

    simulateMessage({ boardString })

    await vi.waitFor(() => {
      expect(mockPostMessage).toHaveBeenCalledWith({
        type: 'error',
        error: errorMessage,
      })
    })
  })

  it('should handle non-Error exceptions', async () => {
    const boardString = 'invalid'
    const errorObject = { message: 'A custom error' }
    vi.mocked(solve_sudoku).mockImplementation(() => {
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw errorObject
    })

    simulateMessage({ boardString })

    await vi.waitFor(() => {
      expect(mockPostMessage).toHaveBeenCalledWith({
        type: 'error',
        error: String(errorObject),
      })
    })
  })
})
