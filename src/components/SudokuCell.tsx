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
import { cn } from '@/lib/utils'

interface SudokuCellProps {
  /** The current value of the cell (1-9) or null if empty. */
  value: number | null
  /** The index of the cell in the board array (0-80). */
  index: number
  /** Whether the cell was part of the initial puzzle. */
  isInitial: boolean
  /** Whether the solver is currently running. */
  isSolving: boolean
  /** Callback function to change the cell's value. */
  onChange: (index: number, value: number | null) => void
}

/**
 * Renders a single, editable cell within the Sudoku grid.
 */
function SudokuCell({
  value,
  index,
  isInitial,
  isSolving,
  onChange,
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
    } else {
      // Any other input (like '0' or a letter) clears the cell.
      onChange(index, null)
    }
  }

  const row = Math.floor(index / 9)
  const col = index % 9

  return (
    <Input
      type="text"
      // Use a pattern to only allow digits, but handle the logic in `handleChange`.
      // This improves the mobile experience by showing a numeric keypad.
      pattern="\d*"
      inputMode="numeric"
      value={value === null ? '' : String(value)}
      onChange={handleChange}
      className={cn(
        'aspect-square size-full rounded-none border-border p-0 text-center text-xl font-semibold transition-colors duration-200 md:text-2xl',
        'focus:z-10 focus:bg-accent focus:shadow-inner',
        'caret-transparent', // Hide the blinking cursor for a cleaner look
        isInitial ? 'text-primary font-bold' : 'text-foreground',
        col % 3 === 2 && col !== 8 && 'border-r-2 border-r-primary',
        row % 3 === 2 && row !== 8 && 'border-b-2 border-b-primary',
        isSolving && 'cursor-not-allowed bg-muted/50',
      )}
      readOnly={isSolving || isInitial}
      aria-label={`Sudoku cell at row ${row + 1}, column ${col + 1}`}
    />
  )
}

export default memo(SudokuCell)
