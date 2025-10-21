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
  /** Whether this cell's number matches the globally highlighted number. */
  readonly isNumberHighlighted: boolean
  /** Callback function when the cell receives focus (e.g., via click). */
  readonly onFocus: (index: number) => void
  /** For visualization, a set of candidates eliminated in the current step. */
  readonly eliminatedCandidates?: ReadonlySet<number>
}

/**
 * Computes the conditional class names for a cell's background.
 * @returns A string of Tailwind classes.
 */
const getBackgroundStyles = ({
  isConflict,
  isActive,
  isSolving,
  isNumberHighlighted,
  isHighlighted,
}: Pick<
  SudokuCellProps,
  | 'isConflict'
  | 'isActive'
  | 'isSolving'
  | 'isNumberHighlighted'
  | 'isHighlighted'
>) => {
  if (isConflict) return '!bg-destructive/20'
  if (isActive) return 'bg-sky-200 dark:bg-sky-800/80'
  if (isSolving) return 'cursor-not-allowed bg-muted/50'
  if (isNumberHighlighted) return 'bg-amber-100/70 dark:bg-amber-900/40'
  if (isHighlighted) return 'bg-sky-100 dark:bg-sky-900/60'
  return ''
}

/**
 * Computes the conditional class names for the cell's main input text.
 * @returns A string of Tailwind classes.
 */
const getInputTextStyles = ({
  cell,
  hasPencilMarks,
  isConflict,
  isInitial,
  isSolved,
  isNumberHighlighted,
}: Pick<
  SudokuCellProps,
  'cell' | 'isConflict' | 'isInitial' | 'isSolved' | 'isNumberHighlighted'
> & { hasPencilMarks: boolean }) => {
  const isSolverResult = isSolved && !isInitial
  return cn({
    'text-transparent': hasPencilMarks && cell.value === null,
    'text-xl md:text-2xl': !(hasPencilMarks && cell.value === null),
    'text-primary font-bold': isInitial,
    'text-foreground': cell.value !== null && !isInitial,
    'font-bold text-amber-600 dark:text-amber-400':
      isNumberHighlighted && !isInitial,
    'text-sky-600 dark:text-sky-400': isSolverResult,
    '!text-destructive': isConflict,
  })
}

/**
 * Renders a single cell within the Sudoku grid.
 * This is a controlled component where all user input is handled by the parent grid.
 * It receives a ref to allow the parent to manage focus.
 */
const SudokuCell = forwardRef<HTMLInputElement, SudokuCellProps>((props, ref) => {
  const {
    cell,
    index,
    onFocus,
    eliminatedCandidates,
    ...styleProps
  } = props
  const handleFocus = () => onFocus(index)

  const row = Math.floor(index / 9)
  const col = index % 9

  const hasPencilMarks = cell.candidates.size > 0 || cell.centers.size > 0

  const backgroundClasses = getBackgroundStyles(styleProps)
  const textClasses = getInputTextStyles({
    ...styleProps,
    cell,
    hasPencilMarks,
  })

  return (
    <div className="relative">
      <div
        data-testid="cell-background"
        className={cn(
          'pointer-events-none absolute inset-0 z-0 flex size-full items-center justify-center',
          backgroundClasses,
        )}
      >
        {cell.value === null && (
          <PencilMarks
            candidates={cell.candidates}
            centers={cell.centers}
            eliminations={eliminatedCandidates}
          />
        )}
      </div>

      <Input
        ref={ref}
        id={`cell-${index}`}
        type="tel"
        readOnly
        value={cell.value === null ? '' : String(cell.value)}
        onFocus={handleFocus}
        className={cn(
          'absolute inset-0 z-10 size-full aspect-square rounded-none border-border bg-transparent p-0 text-center font-semibold transition-colors duration-200',
          'focus:z-20 focus:shadow-inner',
          'caret-transparent',
          col % 3 === 2 && col !== 8 && 'border-r-2 border-r-primary',
          row % 3 === 2 && row !== 8 && 'border-b-2 border-b-primary',
          textClasses,
        )}
        aria-label={`Sudoku cell at row ${row + 1}, column ${col + 1}`}
        aria-invalid={props.isConflict}
      />
    </div>
  )
})

SudokuCell.displayName = 'SudokuCell'
export default memo(SudokuCell)
