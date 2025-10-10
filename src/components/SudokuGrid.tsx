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

import SudokuCell from './SudokuCell'

interface SudokuGridProps {
  /** The current state of the board cells. */
  board: (number | null)[]
  /** The board state before the solver was run. */
  initialBoard: (number | null)[]
  /** Whether the solver is currently active. */
  isSolving: boolean
  /** Callback to handle changes to a cell's value. */
  onCellChange: (index: number, value: number | null) => void
}

/**
 * Renders the 9x9 Sudoku grid container and its cells.
 */
export function SudokuGrid({
  board,
  initialBoard,
  isSolving,
  onCellChange,
}: SudokuGridProps) {
  return (
    <div className="grid aspect-square grid-cols-9 overflow-hidden rounded-lg border-2 border-primary shadow-lg">
      {board.map((cellValue, index) => (
        <SudokuCell
          key={index}
          index={index}
          value={cellValue}
          isInitial={initialBoard[index] !== null}
          isSolving={isSolving}
          onChange={onCellChange}
        />
      ))}
    </div>
  )
}
