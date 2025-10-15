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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SudokuCell from './SudokuCell'
import type { BoardState } from '@/hooks/useSudoku'
import { isMoveValid } from '@/lib/utils'

// Mock the isMoveValid utility to control focus behavior
vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils')>()
  return {
    ...actual,
    isMoveValid: vi.fn(),
  }
})

// Helper to create an empty board
const createEmptyBoard = (): BoardState =>
  Array(81).fill({
    value: null,
    candidates: new Set<number>(),
    centers: new Set<number>(),
  })

describe('SudokuCell component', () => {
  const mockOnChange = vi.fn()
  const mockOnFocus = vi.fn()
  const defaultProps = {
    cell: { value: null, candidates: new Set<number>(), centers: new Set<number>() },
    board: createEmptyBoard(),
    index: 10,
    isInitial: false,
    isSolving: false,
    isSolved: false,
    isConflict: false,
    isActive: false,
    isHighlighted: false,
    inputMode: 'normal' as const,
    onChange: mockOnChange,
    onFocus: mockOnFocus,
  }

  // Helper to mock document.getElementById for focus tests
  const originalGetElementById = document.getElementById
  const mockFocus = vi.fn()
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isMoveValid).mockReturnValue(true)
    document.getElementById = vi.fn((id: string) => {
      if (id.startsWith('cell-')) {
        return { focus: mockFocus } as unknown as HTMLElement
      }
      return originalGetElementById.call(document, id)
    })
  })

  afterEach(() => {
    document.getElementById = originalGetElementById
  })

  describe('Rendering and Visual States', () => {
    it('renders an empty input with correct aria-label and inputMode="none"', () => {
      render(<SudokuCell {...defaultProps} />)
      const input = screen.getByLabelText(/Sudoku cell at row 2, column 2/)
      expect(input).toBeInTheDocument()
      expect(input).toHaveValue('')
      expect(input).toHaveAttribute('inputMode', 'none')
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

    it('is readonly when solving', () => {
      render(<SudokuCell {...defaultProps} isSolving />)
      expect(screen.getByRole('textbox')).toHaveAttribute('readonly')
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

    it('applies correct classes for solver results', () => {
      render(<SudokuCell {...defaultProps} isSolved cell={{ ...defaultProps.cell, value: 7 }} />)
      expect(screen.getByRole('textbox')).toHaveClass('text-sky-600 dark:text-sky-400')
    })

    it('applies border classes for 3x3 grid sections', () => {
      const { rerender } = render(<SudokuCell {...defaultProps} index={26} />) // row 2, col 8
      // Should have a bottom border, but no right border because it's the edge of the grid
      expect(screen.getByRole('textbox')).toHaveClass('border-b-2 border-b-primary')
      expect(screen.getByRole('textbox')).not.toHaveClass('border-r-2 border-r-primary')

      rerender(<SudokuCell {...defaultProps} index={38} />) // row 4, col 2
      // Should have a right border
      expect(screen.getByRole('textbox')).toHaveClass('border-r-2 border-r-primary')
      expect(screen.getByRole('textbox')).not.toHaveClass('border-b-2 border-b-primary')
    })

    it('applies correct classes for an active cell', () => {
      render(<SudokuCell {...defaultProps} isActive />)
      expect(screen.getByTestId('cell-background')).toHaveClass('bg-sky-200')
    })

    it('applies correct classes for a highlighted cell', () => {
      render(<SudokuCell {...defaultProps} isHighlighted />)
      expect(screen.getByTestId('cell-background')).toHaveClass('bg-sky-100')
    })

    it('applies active class when both active and highlighted', () => {
      render(<SudokuCell {...defaultProps} isActive isHighlighted />)
      const background = screen.getByTestId('cell-background')
      expect(background).toHaveClass('bg-sky-200') // Active class takes precedence
      expect(background).not.toHaveClass('bg-sky-100')
    })
  })

  describe('User Input Handling', () => {
    it('calls onChange and onFocus', async () => {
      const user = userEvent.setup()
      render(<SudokuCell {...defaultProps} />)
      const input = screen.getByRole('textbox')
      await user.click(input)
      expect(mockOnFocus).toHaveBeenCalledWith(10)
      await user.type(input, '5')
      expect(mockOnChange).toHaveBeenCalledWith(10, 5)
    })

    it('calls onChange with null when input is cleared', async () => {
      const user = userEvent.setup()
      render(<SudokuCell {...defaultProps} cell={{ ...defaultProps.cell, value: 5 }} />)
      const input = screen.getByRole('textbox')
      await user.clear(input)
      expect(mockOnChange).toHaveBeenCalledWith(10, null)
    })

    it('calls onChange with null for non-numeric or zero input', async () => {
      const user = userEvent.setup()
      render(<SudokuCell {...defaultProps} />)
      const input = screen.getByRole('textbox')
      await user.type(input, 'a')
      expect(mockOnChange).toHaveBeenCalledWith(10, null)
      mockOnChange.mockClear()
      await user.type(input, '0')
      expect(mockOnChange).toHaveBeenCalledWith(10, null)
    })

    it('auto-focuses next cell on valid input in normal mode', async () => {
      const user = userEvent.setup()
      render(<SudokuCell {...defaultProps} />)
      const input = screen.getByRole('textbox')
      await user.type(input, '7')
      expect(mockOnChange).toHaveBeenCalledWith(10, 7)
      expect(document.getElementById).toHaveBeenCalledWith('cell-11')
      expect(mockFocus).toHaveBeenCalled()
    })

    it('does not auto-focus if move is invalid', async () => {
      const user = userEvent.setup()
      vi.mocked(isMoveValid).mockReturnValue(false)
      render(<SudokuCell {...defaultProps} />)
      const input = screen.getByRole('textbox')
      await user.type(input, '7')
      expect(mockFocus).not.toHaveBeenCalled()
    })

    it('does not auto-focus in pencil (candidate) mode', async () => {
      const user = userEvent.setup()
      render(<SudokuCell {...defaultProps} inputMode="candidate" />)
      const input = screen.getByRole('textbox')
      await user.type(input, '7')
      expect(mockOnChange).toHaveBeenCalledWith(10, 7)
      expect(mockFocus).not.toHaveBeenCalled()
    })

    it('does not auto-focus from the last cell', async () => {
      const user = userEvent.setup()
      render(<SudokuCell {...defaultProps} index={80} />)
      const input = screen.getByRole('textbox')
      await user.type(input, '9')
      expect(mockFocus).not.toHaveBeenCalled()
    })
  })

  describe('Keyboard Navigation and Actions', () => {
    it('ignores key presses when solving', async () => {
      const user = userEvent.setup()
      render(<SudokuCell {...defaultProps} isSolving />)
      const input = screen.getByRole('textbox')
      await user.click(input)
      await user.keyboard('{ArrowRight}')
      expect(mockFocus).not.toHaveBeenCalled()
      await user.keyboard('{Backspace}')
      expect(mockOnChange).not.toHaveBeenCalled()
    })

    it.each([
      ['{ArrowRight}', 11],
      ['{ArrowLeft}', 9],
      ['{ArrowDown}', 19],
      ['{ArrowUp}', 1],
    ])('navigates with %s key', async (key, expectedIndex) => {
      const user = userEvent.setup()
      render(<SudokuCell {...defaultProps} />)
      await user.click(screen.getByRole('textbox'))
      await user.keyboard(key)
      expect(document.getElementById).toHaveBeenCalledWith(`cell-${expectedIndex}`)
      expect(mockFocus).toHaveBeenCalled()
    })

    it('does not navigate past boundaries', async () => {
      const user = userEvent.setup()
      render(<SudokuCell {...defaultProps} index={0} />)
      await user.click(screen.getByRole('textbox'))
      await user.keyboard('{ArrowLeft}')
      expect(mockFocus).not.toHaveBeenCalled()
    })

    it('navigates with Enter and Space keys', async () => {
      const user = userEvent.setup()
      render(<SudokuCell {...defaultProps} />)
      const input = screen.getByRole('textbox')
      await user.click(input)

      await user.keyboard('{Enter}')
      expect(document.getElementById).toHaveBeenCalledWith('cell-11')
      expect(mockFocus).toHaveBeenCalledTimes(1)

      await user.keyboard(' ')
      expect(document.getElementById).toHaveBeenCalledWith('cell-11')
      expect(mockFocus).toHaveBeenCalledTimes(2)
    })

    it('clears cell with Delete key and does not move focus', async () => {
      const user = userEvent.setup()
      render(<SudokuCell {...defaultProps} cell={{ ...defaultProps.cell, value: 5 }} />)
      await user.click(screen.getByRole('textbox'))
      await user.keyboard('{Delete}')
      expect(mockOnChange).toHaveBeenCalledWith(10, null)
      expect(mockFocus).not.toHaveBeenCalled()
    })

    it('clears cell with Backspace and moves focus to previous cell', async () => {
      const user = userEvent.setup()
      render(<SudokuCell {...defaultProps} cell={{ ...defaultProps.cell, value: 5 }} />)
      await user.click(screen.getByRole('textbox'))
      await user.keyboard('{Backspace}')
      expect(mockOnChange).toHaveBeenCalledWith(10, null)
      expect(document.getElementById).toHaveBeenCalledWith('cell-9')
      expect(mockFocus).toHaveBeenCalled()
    })

    it('does not move focus with Backspace from the first cell', async () => {
      const user = userEvent.setup()
      render(<SudokuCell {...defaultProps} index={0} cell={{ ...defaultProps.cell, value: 5 }} />)
      await user.click(screen.getByRole('textbox'))
      await user.keyboard('{Backspace}')
      expect(mockOnChange).toHaveBeenCalledWith(0, null)
      expect(mockFocus).not.toHaveBeenCalled()
    })
  })
})
