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

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

// Mock the wasudoku-wasm module. This will be hoisted.
vi.mock('wasudoku-wasm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('wasudoku-wasm')>()
  return {
    ...actual,
    default: vi.fn().mockResolvedValue({}), // Mock the init() promise
    solve_sudoku: vi.fn(),
    generate_sudoku: vi.fn(),
  }
})

describe('Sudoku Worker Logic', () => {
  // Define variables in the describe scope to be accessible in all tests
  let handleMessage: typeof import('@/workers/sudoku.worker').handleMessage
  let init: Mock
  let solve_sudoku: Mock
  let generate_sudoku: Mock
  let mockPostMessage: Mock
  let mockAddEventListener: Mock
  const workerOrigin = 'http://localhost:3000'

  beforeEach(async () => {
    // Reset modules to ensure the worker's top-level code runs for each test
    vi.resetModules()
    vi.clearAllMocks()

    // Redefine mocks for each test run to ensure isolation
    mockPostMessage = vi.fn()
    mockAddEventListener = vi.fn()

    // Stub the global `self` object before importing the worker
    vi.stubGlobal('self', {
      postMessage: mockPostMessage,
      addEventListener: mockAddEventListener,
      location: {
        origin: workerOrigin,
      },
    })

    // Dynamically import the modules within beforeEach to get the fresh instances
    const wasmModule = await import('wasudoku-wasm')
    init = wasmModule.default as Mock
    solve_sudoku = wasmModule.solve_sudoku as Mock
    generate_sudoku = wasmModule.generate_sudoku as Mock

    const workerModule = await import('@/workers/sudoku.worker.ts')
    handleMessage = workerModule.handleMessage
  })

  // Helper to simulate a message event for the handler
  const simulateMessage = (
    data:
      | { type: 'solve'; boardString: string }
      | { type: 'generate'; difficulty: string },
    origin = workerOrigin,
  ) => {
    const event = { data, origin } as MessageEvent
    return handleMessage(event)
  }

  it('should attach the message handler and initialize WASM on module load', () => {
    expect(mockAddEventListener).toHaveBeenCalledOnce()
    expect(mockAddEventListener).toHaveBeenCalledWith('message', handleMessage)
    expect(init).toHaveBeenCalledOnce()
  })

  it('should call solve_sudoku and post a solution', async () => {
    const boardString = '.'.repeat(81)
    const result = { steps: [], solution: '1'.repeat(81) }
    solve_sudoku.mockReturnValue(result)

    await simulateMessage({ type: 'solve', boardString })

    expect(solve_sudoku).toHaveBeenCalledWith(boardString)
    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'solution',
      result,
    })
  })

  it('should call generate_sudoku and post a puzzle string', async () => {
    const difficulty = 'easy'
    const puzzleString = '1....'
    generate_sudoku.mockReturnValue(puzzleString)

    await simulateMessage({ type: 'generate', difficulty })

    expect(generate_sudoku).toHaveBeenCalledWith(difficulty)
    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'puzzle_generated',
      puzzleString,
    })
  })

  it('should not re-initialize the WASM module on subsequent calls', async () => {
    // First call (solve)
    await simulateMessage({ type: 'solve', boardString: '.'.repeat(81) })
    // Second call (generate)
    await simulateMessage({ type: 'generate', difficulty: 'hard' })

    // init() should have only been called once when the module was first loaded
    expect(init).toHaveBeenCalledOnce()
    expect(solve_sudoku).toHaveBeenCalledOnce()
    expect(generate_sudoku).toHaveBeenCalledOnce()
  })

  it('should handle solver errors and post an error message', async () => {
    const boardString = 'invalid'
    const errorMessage = 'No solution found'
    solve_sudoku.mockImplementation(() => {
      throw new Error(errorMessage)
    })

    await simulateMessage({ type: 'solve', boardString })

    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'error',
      error: errorMessage,
    })
  })

  it('should handle generator errors and post an error message', async () => {
    const difficulty = 'impossible'
    const errorMessage = 'Invalid difficulty'
    generate_sudoku.mockImplementation(() => {
      throw new Error(errorMessage)
    })

    await simulateMessage({ type: 'generate', difficulty })

    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'error',
      error: errorMessage,
    })
  })

  it('should handle non-Error exceptions', async () => {
    const errorString = 'A custom non-error was thrown'
    solve_sudoku.mockImplementation(() => {
      throw errorString
    })

    await simulateMessage({ type: 'solve', boardString: '...' })

    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'error',
      error: errorString,
    })
  })

  it('should ignore messages from a foreign origin', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { })
    await simulateMessage({ type: 'solve', boardString: '...' }, 'http://example.com')

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Message from untrusted origin 'http://example.com' ignored.",
    )
    expect(solve_sudoku).not.toHaveBeenCalled()
    expect(generate_sudoku).not.toHaveBeenCalled()
    expect(mockPostMessage).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  it('should correctly handle a null origin for file:// contexts', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { })
    const boardString = '.'.repeat(81)
    const result = { steps: [], solution: '1'.repeat(81) }
    solve_sudoku.mockReturnValue(result)

    // Simulate an event where event.origin is the string "null"
    await simulateMessage({ type: 'solve', boardString }, 'null')

    expect(consoleErrorSpy).not.toHaveBeenCalled()
    expect(solve_sudoku).toHaveBeenCalledWith(boardString)
    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'solution',
      result,
    })
    consoleErrorSpy.mockRestore()
  })
})
