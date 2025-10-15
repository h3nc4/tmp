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
import type { BoardState, CellState, InputMode } from '@/hooks/useSudoku'
import { PencilMarks } from './PencilMarks'

interface SudokuCellProps {
  /** The state of the cell, including value and pencil marks. */
  readonly cell: CellState
  /** The entire board array, used for local validation. */
  readonly board: BoardState
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
  /** The current input mode ('normal', 'candidate', 'center'). */
  readonly inputMode: InputMode
  /** Callback function to change the cell's value. */
  readonly onChange: (index: number, value: number | null) => void
  /** Callback function when the cell receives focus. */
  readonly onFocus: (index: number) => void
}

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
  cell,
  board,
  index,
  isInitial,
  isSolving,
  isSolved,
  isConflict,
  isActive,
  isHighlighted,
  inputMode,
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
      // For normal mode, auto-focus next cell on valid input
      if (inputMode === 'normal' && isMoveValid(board, index, num)) {
        focusNextCell(index)
      }
    } else {
      // Any other input (like '0' or a letter) clears the cell.
      onChange(index, null)
    }
  }

  const handleFocus = () => onFocus(index)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isSolving) return

    let nextIndex = -1
    // Handle navigation
    if (e.key === 'ArrowRight') nextIndex = index + 1
    else if (e.key === 'ArrowLeft') nextIndex = index - 1
    else if (e.key === 'ArrowDown') nextIndex = index + 9
    else if (e.key === 'ArrowUp') nextIndex = index - 9

    if (nextIndex !== -1 && nextIndex >= 0 && nextIndex < 81) {
      e.preventDefault()
      document.getElementById(`cell-${nextIndex}`)?.focus()
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      focusNextCell(index)
    }

    // Handle deletion
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      onChange(index, null)
      // On backspace, move focus to the previous cell for quicker corrections.
      if (e.key === 'Backspace' && index > 0) {
        document.getElementById(`cell-${index - 1}`)?.focus()
      }
    }
  }

  const row = Math.floor(index / 9)
  const col = index % 9
  const isSolverResult = isSolved && !isInitial
  const hasPencilMarks =
    cell.candidates.size > 0 || cell.centers.size > 0

  return (
    <div className="relative">
      <div
        data-testid="cell-background"
        className={cn(
          'pointer-events-none absolute inset-0 z-0 flex size-full items-center justify-center',
          isHighlighted && !isActive && 'bg-sky-100 dark:bg-sky-900/60',
          isActive && 'bg-sky-200 dark:bg-sky-800/80',
          isConflict && '!bg-destructive/20',
          isSolving && 'cursor-not-allowed bg-muted/50',
        )}
      >
        {cell.value === null && (
          <PencilMarks
            candidates={cell.candidates}
            centers={cell.centers}
          />
        )}
      </div>

      <Input
        id={`cell-${index}`}
        type="text"
        pattern="\d*"
        inputMode="numeric"
        value={cell.value === null ? '' : String(cell.value)}
        onChange={handleChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        className={cn(
          'absolute inset-0 z-10 size-full aspect-square rounded-none border-border bg-transparent p-0 text-center font-semibold transition-colors duration-200',
          'focus:z-20 focus:shadow-inner',
          'caret-transparent',
          hasPencilMarks && cell.value === null
            ? 'text-transparent'
            : 'text-xl md:text-2xl',
          isInitial
            ? 'text-primary font-bold'
            : cell.value !== null && 'text-foreground',
          isSolverResult && 'text-sky-600 dark:text-sky-400',
          col % 3 === 2 && col !== 8 && 'border-r-2 border-r-primary',
          row % 3 === 2 && row !== 8 && 'border-b-2 border-b-primary',
          isConflict && '!text-destructive',
        )}
        readOnly={isSolving}
        aria-label={`Sudoku cell at row ${row + 1}, column ${col + 1}`}
        aria-invalid={isConflict}
      />
    </div>
  )
}

export default memo(SudokuCell)
