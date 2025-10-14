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

import { useMemo, useRef, useEffect } from 'react'
import SudokuCell from './SudokuCell'
import { getRelatedCellIndices } from '@/lib/utils'

interface SudokuGridProps {
  /** The current state of the board cells. */
  readonly board: readonly (number | null)[]
  /** The board state before the solver was run. */
  readonly initialBoard: readonly (number | null)[]
  /** Whether the solver is currently active. */
  readonly isSolving: boolean
  /** Whether the board is in a solved state. */
  readonly isSolved: boolean
  /** A set of indices for cells with conflicting values. */
  readonly conflicts: ReadonlySet<number>
  /** The index of the currently focused cell. */
  readonly activeCellIndex: number | null
  /** Callback to handle changes to a cell's value. */
  readonly onCellChange: (index: number, value: number | null) => void
  /** Callback to set the currently focused cell. */
  readonly onCellFocus: (index: number | null) => void
}

/**
 * Renders the 9x9 Sudoku grid container and its cells.
 */
export function SudokuGrid({
  board,
  initialBoard,
  isSolving,
  isSolved,
  conflicts,
  activeCellIndex,
  onCellChange,
  onCellFocus,
}: SudokuGridProps) {
  const gridRef = useRef<HTMLDivElement>(null)

  const highlightedIndices = useMemo(() => {
    if (activeCellIndex === null) {
      return new Set<number>()
    }
    return getRelatedCellIndices(activeCellIndex)
  }, [activeCellIndex])

  // Effect to handle clicks outside the grid to deselect cells.
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (gridRef.current && !gridRef.current.contains(event.target as Node)) {
        onCellFocus(null) // Deselect the cell
      }
    }

    // Add event listener
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      // Clean up the event listener
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [gridRef, onCellFocus])

  return (
    <div
      ref={gridRef}
      className="grid aspect-square grid-cols-9 overflow-hidden rounded-lg border-2 border-primary shadow-lg"
    >
      {board.map((cellValue, index) => {
        const isInitial = initialBoard[index] !== null
        const row = Math.floor(index / 9)
        const col = index % 9
        return (
          <SudokuCell
            key={`sudoku-cell-${row}-${col}`}
            index={index}
            value={cellValue}
            board={board}
            isInitial={isInitial}
            isSolving={isSolving}
            isSolved={isSolved}
            isConflict={conflicts.has(index)}
            isActive={activeCellIndex === index}
            isHighlighted={highlightedIndices.has(index)}
            onChange={onCellChange}
            onFocus={onCellFocus}
          />
        )
      })}
    </div>
  )
}
