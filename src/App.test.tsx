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

import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

// --- Mocks ---

// This mock captures the worker instance so tests can simulate messages from it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockWorkerInstance: any
vi.mock('@/solver.worker?worker', () => {
  class MockWorker {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onmessage: ((event: any) => void) | null = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    postMessageListeners: any[] = []
    constructor() {
      mockWorkerInstance = this
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addEventListener(event: string, listener: any) {
      if (event === 'message') this.onmessage = listener
    }

    removeEventListener() {
      // no-op
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    postMessage(data: any) {
      this.postMessageListeners.forEach((l) => l(data))
    }

    terminate() {
      // no-op
    }

    // Helper for tests to simulate messages FROM the worker
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    __simulateMessage(data: any) {
      if (this.onmessage) this.onmessage({ data })
    }

    // Helper for tests to listen for messages posted TO the worker
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    __addPostMessageListener(listener: any) {
      this.postMessageListeners.push(listener)
    }
  }
  return { default: MockWorker }
})

vi.mock('sonner', () => ({
  Toaster: () => null, // Mock the Toaster component to avoid rendering it
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

// --- Tests ---

describe('App component (Integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWorkerInstance = null
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders with solve and clear buttons disabled initially', () => {
    render(<App />)
    const solveButton = screen.getByRole('button', { name: /solve puzzle/i })
    const clearButton = screen.getByRole('button', { name: /clear board/i })
    expect(solveButton).toBeDisabled()
    expect(solveButton).toHaveAttribute('title', 'Board is empty.')
    expect(clearButton).toBeDisabled()
    expect(clearButton).toHaveAttribute('title', 'Board is already empty.')
  })

  it('allows user to input numbers and clear the board', async () => {
    const user = userEvent.setup()
    render(<App />)

    const cells = screen.getAllByRole('textbox')
    const clearButton = screen.getByRole('button', { name: /clear board/i })

    expect(clearButton).toBeDisabled()

    await user.type(cells[0], '5')
    expect(cells[0]).toHaveValue('5')
    expect(clearButton).not.toBeDisabled()

    await user.click(clearButton)
    expect(cells[0]).toHaveValue('')
  })

  it('prevents solving with conflicts and solves a valid board', async () => {
    const user = userEvent.setup()
    const postMessageSpy = vi.fn()
    render(<App />)

    await waitFor(() => {
      expect(mockWorkerInstance).toBeDefined()
      mockWorkerInstance.__addPostMessageListener(postMessageSpy)
    })

    const cells = screen.getAllByRole('textbox')
    const solveButton = screen.getByRole('button', { name: /solve puzzle/i })

    // Create a conflict
    await user.type(cells[0], '1')
    await user.type(cells[1], '1')

    expect(solveButton).toBeDisabled()
    expect(solveButton).toHaveAttribute('title', 'Cannot solve with conflicts.')

    // Fix the conflict
    await user.click(cells[1])
    await user.keyboard('{Backspace}')
    await user.type(cells[1], '2')
    expect(solveButton).not.toBeDisabled()

    // Solve
    await user.click(solveButton)

    // Check for "Solving..." state with delay
    await waitFor(
      () => {
        expect(screen.getByText(/solving.../i)).toBeInTheDocument()
      },
      { timeout: 600 },
    ) // Timeout > 500ms delay in component

    expect(postMessageSpy).toHaveBeenCalledWith({
      boardString: '12' + '.'.repeat(79),
    })

    // Simulate successful solve from worker, wrapping the state update in act()
    const solution = '123456789'.repeat(9)
    act(() => {
      mockWorkerInstance.__simulateMessage({ type: 'solution', solution })
    })

    // Wait for the UI to reflect the solved state, specifically for the
    // "Solving..." text to disappear, which confirms the state change has rendered.
    await waitFor(() => {
      expect(screen.queryByText(/solving.../i)).not.toBeInTheDocument()
    })

    // Now that the UI is stable, assert the final state of the board and controls.
    expect(cells[80]).toHaveValue('9')
    expect(solveButton).toBeDisabled()
    expect(solveButton).toHaveAttribute('title', 'Board is already full.')
  })

  it('handles solver failure and allows re-solving after board change', async () => {
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => expect(mockWorkerInstance).toBeDefined())
    const cells = screen.getAllByRole('textbox')
    const solveButton = screen.getByRole('button', { name: /solve puzzle/i })

    // Input a puzzle and try to solve
    await user.type(cells[0], '1')
    await user.click(solveButton)

    // Simulate failure
    const errorMessage = 'No solution found'
    act(() => {
      mockWorkerInstance.__simulateMessage({ type: 'error', error: errorMessage })
    })

    // Button should be disabled due to failure
    await waitFor(() => {
      expect(solveButton).toBeDisabled()
    })
    expect(solveButton).toHaveAttribute(
      'title',
      'Solving failed. Please change the board to try again.',
    )

    // Change the board, which should re-enable the button
    await user.type(cells[1], '2')
    expect(solveButton).not.toBeDisabled()
  })
})
