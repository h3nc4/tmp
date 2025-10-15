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

import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest'
import { SolveButton } from './SolveButton'
import {
  useSudokuState,
  useSudokuDispatch,
} from '@/context/sudoku.hooks'
import { initialState } from '@/context/sudoku.reducer'

// Mocks
vi.mock('@/context/sudoku.hooks')
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

const mockUseSudokuState = useSudokuState as Mock
const mockUseSudokuDispatch = useSudokuDispatch as Mock

describe('SolveButton component', () => {
  const mockDispatch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSudokuState.mockReturnValue(initialState)
    mockUseSudokuDispatch.mockReturnValue(mockDispatch)
  })

  it('is disabled and has correct title when board is empty', () => {
    mockUseSudokuState.mockReturnValue({ ...initialState, isBoardEmpty: true })
    render(<SolveButton />)
    const button = screen.getByRole('button', { name: 'Solve Puzzle' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', 'Board is empty.')
  })

  it('is enabled when board has values and no conflicts', () => {
    mockUseSudokuState.mockReturnValue({
      ...initialState,
      isBoardEmpty: false,
      conflicts: new Set(),
    })
    render(<SolveButton />)
    expect(
      screen.getByRole('button', { name: 'Solve Puzzle' }),
    ).not.toBeDisabled()
  })

  it('is disabled and shows conflict title when there are conflicts', () => {
    mockUseSudokuState.mockReturnValue({
      ...initialState,
      isBoardEmpty: false,
      conflicts: new Set([0, 1]),
    })
    render(<SolveButton />)
    const button = screen.getByRole('button', { name: 'Solve Puzzle' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', 'Cannot solve with conflicts.')
  })

  it('is disabled and shows correct title when board is full', () => {
    mockUseSudokuState.mockReturnValue({ ...initialState, isBoardFull: true })
    render(<SolveButton />)
    const button = screen.getByRole('button', { name: 'Solve Puzzle' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', 'Board is already full.')
  })

  it('is disabled and shows correct title when solve has failed', () => {
    mockUseSudokuState.mockReturnValue({
      ...initialState,
      isBoardEmpty: false,
      solveFailed: true,
    })
    render(<SolveButton />)
    const button = screen.getByRole('button', { name: 'Solve Puzzle' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute(
      'title',
      'Solving failed. Please change the board to try again.',
    )
  })

  it('dispatches SOLVE_START on click when valid', async () => {
    const user = userEvent.setup()
    mockUseSudokuState.mockReturnValue({
      ...initialState,
      isBoardEmpty: false,
      conflicts: new Set(),
    })
    render(<SolveButton />)

    await user.click(screen.getByRole('button', { name: 'Solve Puzzle' }))
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'SOLVE_START' })
  })

  it('shows and hides "Solving..." state correctly based on isSolving prop', () => {
    vi.useFakeTimers()
    const solvingState = { ...initialState, isSolving: true }

    const { rerender } = render(<SolveButton />)
    mockUseSudokuState.mockReturnValue(solvingState)

    // Rerender with isSolving = true
    rerender(<SolveButton />)

    // Should not be visible immediately
    expect(screen.queryByText('Solving...')).not.toBeInTheDocument()

    // Becomes visible after the delay
    act(() => {
      vi.advanceTimersByTime(501)
    })
    expect(screen.getByText('Solving...')).toBeInTheDocument()

    // Rerender with isSolving = false, which should trigger the cleanup
    mockUseSudokuState.mockReturnValue(initialState)
    rerender(<SolveButton />)

    // Should disappear immediately
    expect(screen.queryByText('Solving...')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Solve Puzzle' }),
    ).toBeInTheDocument()

    vi.useRealTimers()
  })
})
