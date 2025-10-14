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

describe('SudokuCell component', () => {
  const mockOnChange = vi.fn()
  const mockOnFocus = vi.fn()
  const defaultProps = {
    value: null,
    board: Array(81).fill(null),
    index: 10, // Not a corner to test all navigation (Row 1, Col 1)
    isInitial: false,
    isSolving: false,
    isSolved: false,
    isConflict: false,
    isActive: false,
    isHighlighted: false,
    onChange: mockOnChange,
    onFocus: mockOnFocus,
  }

  // Helper to mock document.getElementById for focus tests
  const originalGetElementById = document.getElementById
  const mockFocus = vi.fn()
  beforeEach(() => {
    vi.clearAllMocks()
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

  it('renders an empty input with correct aria-label', () => {
    render(<SudokuCell {...defaultProps} />)
    const input = screen.getByLabelText(/Sudoku cell at row 2, column 2/)
    expect(input).toBeInTheDocument()
    expect(input).toHaveValue('')
  })

  it('renders a cell with a value', () => {
    render(<SudokuCell {...defaultProps} value={5} />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveValue('5')
  })

  it('applies styling for an initial cell', () => {
    render(<SudokuCell {...defaultProps} value={5} isInitial={true} />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveClass('text-primary')
    expect(input).toHaveAttribute('readonly')
  })

  it('applies styling for a conflict cell', () => {
    render(<SudokuCell {...defaultProps} value={5} isConflict={true} />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveClass('!bg-destructive/20')
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('calls onChange with number and focuses next cell on valid input', async () => {
    const user = userEvent.setup()
    render(<SudokuCell {...defaultProps} />)
    const input = screen.getByRole('textbox')
    await user.type(input, '7')
    expect(mockOnChange).toHaveBeenCalledWith(10, 7)
    expect(document.getElementById).toHaveBeenCalledWith('cell-11')
    expect(mockFocus).toHaveBeenCalled()
  })

  it('calls onChange but does not focus next cell on invalid move', async () => {
    const user = userEvent.setup()
    // Create a conflict on the board
    const boardWithConflict = [...defaultProps.board]
    boardWithConflict[17] = 7 // Same row
    render(<SudokuCell {...defaultProps} board={boardWithConflict} />)

    const input = screen.getByRole('textbox')
    await user.type(input, '7')
    expect(mockOnChange).toHaveBeenCalledWith(10, 7)
    // Should not have tried to focus the next cell
    expect(mockFocus).not.toHaveBeenCalled()
  })

  it('calls onChange with null when user types 0 or non-numeric', async () => {
    const user = userEvent.setup()
    render(<SudokuCell {...defaultProps} />)
    const input = screen.getByRole('textbox')

    await user.type(input, '0')
    expect(mockOnChange).toHaveBeenCalledWith(10, null)
    mockOnChange.mockClear()

    await user.type(input, 'a')
    expect(mockOnChange).toHaveBeenCalledWith(10, null)
  })

  it('calls onChange with null when input is cleared', async () => {
    const user = userEvent.setup()
    render(<SudokuCell {...defaultProps} value={5} />)
    const input = screen.getByRole('textbox')

    await user.clear(input)
    expect(mockOnChange).toHaveBeenCalledWith(10, null)
  })

  it('calls onFocus when the cell is focused', async () => {
    const user = userEvent.setup()
    render(<SudokuCell {...defaultProps} />)
    const input = screen.getByRole('textbox')
    await user.click(input)
    expect(mockOnFocus).toHaveBeenCalledWith(10)
  })

  it('handles keyboard navigation with arrow keys', async () => {
    const user = userEvent.setup()
    render(<SudokuCell {...defaultProps} />)
    const input = screen.getByRole('textbox')
    input.focus()

    await user.keyboard('{ArrowRight}')
    expect(document.getElementById).toHaveBeenCalledWith('cell-11')
    expect(mockFocus).toHaveBeenCalledTimes(1)

    await user.keyboard('{ArrowLeft}')
    expect(document.getElementById).toHaveBeenCalledWith('cell-9')
    expect(mockFocus).toHaveBeenCalledTimes(2)

    await user.keyboard('{ArrowDown}')
    expect(document.getElementById).toHaveBeenCalledWith('cell-19')
    expect(mockFocus).toHaveBeenCalledTimes(3)

    await user.keyboard('{ArrowUp}')
    expect(document.getElementById).toHaveBeenCalledWith('cell-1')
    expect(mockFocus).toHaveBeenCalledTimes(4)
  })

  it('focuses next cell with Enter and Space keys', async () => {
    const user = userEvent.setup()
    render(<SudokuCell {...defaultProps} />)
    const input = screen.getByRole('textbox')
    input.focus()

    await user.keyboard('{Enter}')
    expect(document.getElementById).toHaveBeenCalledWith('cell-11')
    expect(mockFocus).toHaveBeenCalledTimes(1)

    await user.keyboard(' ')
    expect(document.getElementById).toHaveBeenCalledWith('cell-11')
    expect(mockFocus).toHaveBeenCalledTimes(2)
  })

  it('handles deletion with Backspace and focuses previous cell', async () => {
    const user = userEvent.setup()
    render(<SudokuCell {...defaultProps} value={5} />)
    const input = screen.getByRole('textbox')
    input.focus()
    await user.keyboard('{Backspace}')
    expect(mockOnChange).toHaveBeenCalledWith(10, null)
    expect(document.getElementById).toHaveBeenCalledWith('cell-9')
    expect(mockFocus).toHaveBeenCalled()
  })

  it('handles deletion with Delete and does not change focus', async () => {
    const user = userEvent.setup()
    render(<SudokuCell {...defaultProps} value={5} />)
    const input = screen.getByRole('textbox')
    input.focus()
    await user.keyboard('{Delete}')
    expect(mockOnChange).toHaveBeenCalledWith(10, null)
    expect(mockFocus).not.toHaveBeenCalled()
  })

  it('does nothing on Backspace if cell is already empty', async () => {
    const user = userEvent.setup()
    render(<SudokuCell {...defaultProps} value={null} />)
    const input = screen.getByRole('textbox')
    input.focus()
    await user.keyboard('{Backspace}')
    expect(mockOnChange).not.toHaveBeenCalled()
    // It should still try to focus the previous cell
    expect(document.getElementById).toHaveBeenCalledWith('cell-9')
    expect(mockFocus).toHaveBeenCalled()
  })

  it('should do nothing on keydown when isSolving is true', async () => {
    const user = userEvent.setup()
    render(<SudokuCell {...defaultProps} isSolving={true} />)
    const input = screen.getByRole('textbox')
    input.focus()
    await user.keyboard('{ArrowRight}')

    // No navigation should happen, so getElementById should not be called
    expect(mockFocus).not.toHaveBeenCalled()
    // onChange shouldn't be called either
    await user.keyboard('{Backspace}')
    expect(mockOnChange).not.toHaveBeenCalled()
  })
})
