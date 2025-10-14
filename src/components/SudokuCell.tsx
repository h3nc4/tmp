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

import { memo } from 'react'
import { Input } from '@/components/ui/input'
import { cn, isMoveValid } from '@/lib/utils'

interface SudokuCellProps {
  /** The current value of the cell (1-9) or null if empty. */
  readonly value: number | null
  /** The entire board array, used for local validation. */
  readonly board: readonly (number | null)[]
  /** The index of the cell in the board array (0-80). */
  readonly index: number
  /** Whether the cell was part of the initial puzzle. */
  readonly isInitial: boolean
  /** Whether the solver is currently running. */
  readonly isSolving: boolean
  /** Whether the board is in a solved state. */
  readonly isSolved: boolean
  /** Whether this cell has a conflicting value. */
  readonly isConflict: boolean
  /** Whether this is the currently active/focused cell. */
  readonly isActive: boolean
  /** Whether this cell should be highlighted as part of the active row/column/box. */
  readonly isHighlighted: boolean
  /** Callback function to change the cell's value. */
  readonly onChange: (index: number, value: number | null) => void
  /** Callback function when the cell receives focus. */
  readonly onFocus: (index: number) => void
}

/**
 * Focuses on the next available cell in the grid.
 * @param currentIndex The index of the current cell.
 */
function focusNextCell(currentIndex: number) {
  if (currentIndex < 80) {
    const nextCell = document.getElementById(`cell-${currentIndex + 1}`)
    nextCell?.focus()
  }
}

/**
 * Renders a single, editable cell within the Sudoku grid.
 */
function SudokuCell({
  value,
  board,
  index,
  isInitial,
  isSolving,
  isSolved,
  isConflict,
  isActive,
  isHighlighted,
  onChange,
  onFocus,
}: SudokuCellProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value

    // If the input is empty (e.g., from a backspace), clear the cell.
    if (inputValue === '') {
      onChange(index, null)
      return
    }

    // Use the last character of the input.
    const lastChar = inputValue.slice(-1)
    const num = parseInt(lastChar, 10)

    // A valid input is a number from 1 to 9.
    if (!isNaN(num) && num > 0) {
      onChange(index, num)
      // Focus the next cell only if the move is valid.
      if (isMoveValid(board, index, num)) {
        focusNextCell(index)
      }
    } else {
      // Any other input (like '0' or a letter) clears the cell.
      onChange(index, null)
    }
  }

  const handleFocus = () => {
    onFocus(index)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isSolving) return

    let nextIndex = -1
    // Handle navigation
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      nextIndex = index + 1
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      nextIndex = index - 1
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      nextIndex = index + 9
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      nextIndex = index - 9
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      focusNextCell(index)
    }

    if (nextIndex >= 0 && nextIndex < 81) {
      const nextCell = document.getElementById(`cell-${nextIndex}`)
      nextCell?.focus()
    }

    // Handle deletion
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      if (value !== null) {
        onChange(index, null)
      }
      // On backspace, move focus to the previous cell for quicker corrections.
      if (e.key === 'Backspace' && index > 0) {
        const prevIndex = index - 1
        const prevCell = document.getElementById(`cell-${prevIndex}`)
        prevCell?.focus()
      }
    }
  }

  const row = Math.floor(index / 9)
  const col = index % 9
  const isSolverResult = isSolved && !isInitial

  return (
    <Input
      id={`cell-${index}`}
      type="text"
      // Use a pattern to only allow digits, but handle the logic in `handleChange`.
      // This improves the mobile experience by showing a numeric keypad.
      pattern="\d*"
      inputMode="numeric"
      value={value === null ? '' : String(value)}
      onChange={handleChange}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
      className={cn(
        'aspect-square size-full rounded-none border-border p-0 text-center text-xl font-semibold transition-colors duration-200 md:text-2xl',
        'focus:z-10 focus:shadow-inner', // z-10 to bring focused cell to front
        'caret-transparent', // Hide the blinking cursor for a cleaner look

        // Highlighting for active/related cells.
        // Uses the `sky` color palette.
        isHighlighted && !isActive && 'bg-sky-100 dark:bg-sky-900/60',
        isActive && 'bg-sky-200 dark:bg-sky-800/80',

        // Styling for different number types
        isInitial ? 'text-primary font-bold' : 'text-foreground',
        isSolverResult && 'text-sky-600 dark:text-sky-400',

        // Border styling for 3x3 boxes
        col % 3 === 2 && col !== 8 && 'border-r-2 border-r-primary',
        row % 3 === 2 && row !== 8 && 'border-b-2 border-b-primary',

        // Conflict styling (overrides other styles)
        isConflict && '!bg-destructive/20 !text-destructive',

        // State-based styling
        isSolving && 'cursor-not-allowed bg-muted/50',
      )}
      readOnly={isSolving}
      aria-label={`Sudoku cell at row ${row + 1}, column ${col + 1}`}
      aria-invalid={isConflict}
    />
  )
}

export default memo(SudokuCell)
