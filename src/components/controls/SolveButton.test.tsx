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
import { useSudokuState } from '@/context/sudoku.hooks'
import { useSudokuActions } from '@/hooks/useSudokuActions'
import { initialState } from '@/context/sudoku.reducer'
import type { SudokuState } from '@/context/sudoku.types'

// Mocks
vi.mock('@/context/sudoku.hooks')
vi.mock('@/hooks/useSudokuActions')
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

const mockUseSudokuState = useSudokuState as Mock
const mockUseSudokuActions = useSudokuActions as Mock

describe('SolveButton component', () => {
  const mockSolve = vi.fn()
  const mockExitVisualization = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSudokuState.mockReturnValue(initialState)
    mockUseSudokuActions.mockReturnValue({
      solve: mockSolve,
      exitVisualization: mockExitVisualization,
    })
  })

  describe('in "playing" mode', () => {
    it('is disabled and has correct title when board is empty', () => {
      mockUseSudokuState.mockReturnValue({
        ...initialState,
        derived: { ...initialState.derived, isBoardEmpty: true },
      })
      render(<SolveButton />)
      const button = screen.getByRole('button', { name: 'Solve Puzzle' })
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute('title', 'Board is empty.')
    })

    it('is enabled when board has values and no conflicts', () => {
      mockUseSudokuState.mockReturnValue({
        ...initialState,
        derived: {
          ...initialState.derived,
          isBoardEmpty: false,
          conflicts: new Set(),
        },
      })
      render(<SolveButton />)
      expect(
        screen.getByRole('button', { name: 'Solve Puzzle' }),
      ).not.toBeDisabled()
    })

    it('is disabled and shows conflict title when there are conflicts', () => {
      mockUseSudokuState.mockReturnValue({
        ...initialState,
        derived: {
          ...initialState.derived,
          isBoardEmpty: false,
          conflicts: new Set([0, 1]),
        },
      })
      render(<SolveButton />)
      const button = screen.getByRole('button', { name: 'Solve Puzzle' })
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute('title', 'Cannot solve with conflicts.')
    })

    it('is disabled and shows correct title when board is full', () => {
      mockUseSudokuState.mockReturnValue({
        ...initialState,
        derived: { ...initialState.derived, isBoardFull: true },
      })
      render(<SolveButton />)
      const button = screen.getByRole('button', { name: 'Solve Puzzle' })
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute('title', 'Board is already full.')
    })

    it('is disabled and shows correct title when solve has failed', () => {
      mockUseSudokuState.mockReturnValue({
        ...initialState,
        derived: { ...initialState.derived, isBoardEmpty: false },
        solver: { ...initialState.solver, solveFailed: true },
      })
      render(<SolveButton />)
      const button = screen.getByRole('button', { name: 'Solve Puzzle' })
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute(
        'title',
        'Solving failed. Please change the board to try again.',
      )
    })

    it('calls solve on click when valid', async () => {
      const user = userEvent.setup()
      mockUseSudokuState.mockReturnValue({
        ...initialState,
        derived: {
          ...initialState.derived,
          isBoardEmpty: false,
          conflicts: new Set(),
        },
      })
      render(<SolveButton />)

      await user.click(screen.getByRole('button', { name: 'Solve Puzzle' }))
      expect(mockSolve).toHaveBeenCalled()
    })

    it('shows and hides "Solving..." state correctly based on isSolving prop', () => {
      vi.useFakeTimers()
      const solvingState: SudokuState = {
        ...initialState,
        solver: { ...initialState.solver, isSolving: true },
      }

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

  describe('in "visualizing" mode', () => {
    const visualizingState: SudokuState = {
      ...initialState,
      solver: { ...initialState.solver, gameMode: 'visualizing' },
    }

    it('renders an "Exit Visualization" button', () => {
      mockUseSudokuState.mockReturnValue(visualizingState)
      render(<SolveButton />)
      expect(
        screen.getByRole('button', { name: /exit visualization/i }),
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /solve puzzle/i }),
      ).not.toBeInTheDocument()
    })

    it('calls exitVisualization on click', async () => {
      const user = userEvent.setup()
      mockUseSudokuState.mockReturnValue(visualizingState)
      render(<SolveButton />)
      await user.click(
        screen.getByRole('button', { name: /exit visualization/i }),
      )
      expect(mockExitVisualization).toHaveBeenCalled()
    })
  })
})
