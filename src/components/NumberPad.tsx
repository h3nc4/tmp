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

import { memo, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import {
  useSudokuState,
  useSudokuDispatch,
} from '@/context/sudoku.hooks'
import { inputValue, setHighlightedValue } from '@/context/sudoku.actions'

const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

/**
 * An on-screen number pad for touch-friendly input. It displays a counter
 * for each number, indicating how many are left to be placed.
 */
export const NumberPad = memo(function NumberPad() {
  const { board, activeCellIndex } = useSudokuState()
  const dispatch = useSudokuDispatch()

  const numberCounts = useMemo(() => {
    const counts = new Array(10).fill(0)
    for (const cell of board) {
      if (cell.value !== null) {
        counts[cell.value]++
      }
    }
    return counts
  }, [board])

  const handleNumberClick = useCallback(
    (value: number) => {
      // Always highlight the number that was tapped
      dispatch(setHighlightedValue(value))
      // Only input the value if a cell is active
      if (activeCellIndex !== null) {
        dispatch(inputValue(value))
      }
    },
    [activeCellIndex, dispatch],
  )

  return (
    <div
      className="grid grid-cols-9 gap-1"
      aria-label="On-screen number pad"
    >
      {NUMBERS.map((num) => {
        const remaining = 9 - numberCounts[num]
        const isComplete = remaining <= 0

        return (
          <Button
            key={`pad-${num}`}
            variant="outline"
            size="icon"
            className="aspect-square h-auto w-full"
            onClick={() => handleNumberClick(num)}
            disabled={isComplete}
            aria-label={`Enter number ${num}`}
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="relative flex size-full items-center justify-center">
              <span className="text-lg font-medium">{num}</span>
              {!isComplete && (
                <span className="absolute bottom-1 right-1.5 text-[0.6rem] text-muted-foreground">
                  {remaining}
                </span>
              )}
            </div>
          </Button>
        )
      })}
    </div>
  )
})
