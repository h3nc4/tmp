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

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SudokuCell from './SudokuCell'

describe('SudokuCell component', () => {
  const mockOnFocus = vi.fn()
  const defaultProps = {
    cell: { value: null, candidates: new Set<number>(), centers: new Set<number>() },
    index: 10,
    isInitial: false,
    isSolving: false,
    isSolved: false,
    isConflict: false,
    isActive: false,
    isHighlighted: false,
    isNumberHighlighted: false,
    isCause: false,
    onFocus: mockOnFocus,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering and Visual States', () => {
    it('renders a readonly input with correct aria-label and type="tel"', () => {
      render(<SudokuCell {...defaultProps} />)
      const input = screen.getByLabelText(/Sudoku cell at row 2, column 2/)
      expect(input).toBeInTheDocument()
      expect(input).toHaveValue('')
      expect(input).toHaveAttribute('type', 'tel')
      expect(input).toHaveAttribute('readonly')
    })

    it('renders a cell with a definitive value', () => {
      render(<SudokuCell {...defaultProps} cell={{ ...defaultProps.cell, value: 5 }} />)
      expect(screen.getByRole('textbox')).toHaveValue('5')
    })

    it('renders pencil marks when value is null', () => {
      render(
        <SudokuCell
          {...defaultProps}
          cell={{ ...defaultProps.cell, candidates: new Set([1, 9]) }}
        />,
      )
      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('9')).toBeInTheDocument()
      expect(screen.getByRole('textbox')).toHaveClass('text-transparent')
    })

    it('renders eliminated pencil marks with line-through style', () => {
      render(
        <SudokuCell
          {...defaultProps}
          cell={{ ...defaultProps.cell, candidates: new Set([1, 9]) }}
          eliminatedCandidates={new Set([9])}
        />,
      )
      expect(screen.getByText('1')).not.toHaveClass('line-through')
      expect(screen.getByText('9')).toHaveClass('line-through')
    })

    it('is marked as invalid when in conflict', () => {
      render(<SudokuCell {...defaultProps} isConflict />)
      expect(screen.getByRole('textbox')).toBeInvalid()
      expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
    })

    it('applies correct classes for initial numbers', () => {
      render(<SudokuCell {...defaultProps} isInitial cell={{ ...defaultProps.cell, value: 7 }} />)
      expect(screen.getByRole('textbox')).toHaveClass('text-primary font-bold')
    })

    it('applies correct classes for solver-added numbers', () => {
      render(
        <SudokuCell
          {...defaultProps}
          isSolved
          isInitial={false}
          cell={{ ...defaultProps.cell, value: 7 }}
        />,
      )
      expect(screen.getByRole('textbox')).toHaveClass('text-sky-600 dark:text-sky-400')
    })

    it('applies correct background for an active cell', () => {
      render(<SudokuCell {...defaultProps} isActive />)
      expect(screen.getByTestId('cell-background')).toHaveClass('bg-sky-200 dark:bg-sky-800/80')
    })

    it('applies correct background for a highlighted (but not active) cell', () => {
      render(<SudokuCell {...defaultProps} isHighlighted isActive={false} />)
      expect(screen.getByTestId('cell-background')).toHaveClass('bg-sky-100 dark:bg-sky-900/60')
    })

    it('applies correct background for a number-highlighted cell', () => {
      render(
        <SudokuCell
          {...defaultProps}
          isNumberHighlighted
          cell={{ ...defaultProps.cell, value: 5 }}
        />,
      )
      expect(screen.getByTestId('cell-background')).toHaveClass(
        'bg-amber-100/70 dark:bg-amber-900/40',
      )
    })

    it('applies correct background when solving', () => {
      render(<SudokuCell {...defaultProps} isSolving />)
      expect(screen.getByTestId('cell-background')).toHaveClass('cursor-not-allowed bg-muted/50')
    })

    it('applies correct background for a cause cell in visualization', () => {
      render(<SudokuCell {...defaultProps} isCause />)
      expect(screen.getByTestId('cell-background')).toHaveClass(
        'bg-purple-200 dark:bg-purple-800/80',
      )
    })

    it('applies correct border for right edge of a box', () => {
      render(<SudokuCell {...defaultProps} index={2} />) // col 2
      expect(screen.getByRole('textbox')).toHaveClass('border-r-2 border-r-primary')
    })

    it('applies correct border for bottom edge of a box', () => {
      render(<SudokuCell {...defaultProps} index={18} />) // row 2
      expect(screen.getByRole('textbox')).toHaveClass('border-b-2 border-b-primary')
    })
  })

  describe('User Interaction', () => {
    it('calls onFocus when the input is focused (e.g., by clicking)', async () => {
      const user = userEvent.setup()
      render(<SudokuCell {...defaultProps} />)
      await user.click(screen.getByRole('textbox'))
      expect(mockOnFocus).toHaveBeenCalledWith(10)
    })
  })
})
