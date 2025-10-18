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
import { cn } from '@/lib/utils'

interface SudokuPencilMarksProps {
  readonly candidates: ReadonlySet<number>
  readonly centers: ReadonlySet<number>
  /** A set of candidates to be rendered with a "strike-through" style. */
  readonly eliminations?: ReadonlySet<number>
}

const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

/**
 * Renders the candidate (corner) or center pencil marks within a Sudoku cell.
 * During visualization, it can also render eliminated candidates.
 */
export const PencilMarks = memo(function PencilMarks({
  candidates,
  centers,
  eliminations,
}: SudokuPencilMarksProps) {
  const baseClasses = 'text-muted-foreground/80'

  if (centers.size > 0) {
    // Center marks rendering
    const sortedCenters = [...centers].sort((a, b) => a - b)
    const fontSize = centers.size > 4 ? 'text-[0.6rem]' : 'text-xs'
    return (
      <div className="flex size-full items-center justify-center p-1">
        {sortedCenters.map((num) => (
          <span
            key={`center-${num}`}
            className={`${baseClasses} ${fontSize} leading-none`}
          >
            {num}
          </span>
        ))}
      </div>
    )
  }

  if (candidates.size > 0) {
    // Candidate marks rendering
    return (
      <div className="grid size-full grid-cols-3 grid-rows-3 p-0.5">
        {NUMBERS.map((num) => (
          <div
            key={`candidate-${num}`}
            className={`${baseClasses} flex items-center justify-center text-[0.5rem] leading-none md:text-[0.6rem]`}
          >
            {candidates.has(num) ? (
              <span
                className={cn(
                  eliminations?.has(num) && 'text-destructive/80 line-through',
                )}
              >
                {num}
              </span>
            ) : (
              ''
            )}
          </div>
        ))}
      </div>
    )
  }

  return null
})
