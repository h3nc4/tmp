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

import { memo, forwardRef } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { CellState } from '@/context/sudoku.types'
import { PencilMarks } from './PencilMarks'

interface SudokuCellProps {
  /** The state of the cell, including value and pencil marks. */
  readonly cell: CellState
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
  /** Callback function when the cell receives focus (e.g., via click). */
  readonly onFocus: (index: number) => void
}

/**
 * Renders a single cell within the Sudoku grid.
 * This is a controlled component where all user input is handled by the parent grid.
 * It receives a ref to allow the parent to manage focus.
 */
const SudokuCell = forwardRef<HTMLInputElement, SudokuCellProps>(
  (
    {
      cell,
      index,
      isInitial,
      isSolving,
      isSolved,
      isConflict,
      isActive,
      isHighlighted,
      onFocus,
    },
    ref,
  ) => {
    const handleFocus = () => onFocus(index)

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
          ref={ref}
          id={`cell-${index}`}
          type="tel"
          // All keyboard input is captured by the parent grid's onKeyDown handler.
          // This input is read-only to prevent mobile keyboards from appearing
          // and interfering with our custom keyboard logic. It only exists to
          // receive focus and display the cell's value.
          readOnly
          value={cell.value === null ? '' : String(cell.value)}
          onFocus={handleFocus}
          className={cn(
            'absolute inset-0 z-10 size-full aspect-square rounded-none border-border bg-transparent p-0 text-center font-semibold transition-colors duration-200',
            'focus:z-20 focus:shadow-inner',
            'caret-transparent', // Hide the cursor
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
          aria-label={`Sudoku cell at row ${row + 1}, column ${col + 1}`}
          aria-invalid={isConflict}
        />
      </div>
    )
  },
)

SudokuCell.displayName = 'SudokuCell'
export default memo(SudokuCell)
