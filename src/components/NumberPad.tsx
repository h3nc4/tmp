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
import { Button } from '@/components/ui/button'

interface NumberPadProps {
  /** Callback function when a number button is clicked. */
  readonly onNumberClick: (value: number) => void
  /** Whether the number pad should be disabled (e.g., when no cell is active). */
  readonly disabled: boolean
}

const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

/**
 * An on-screen number pad for touch-friendly input on mobile devices.
 */
export const NumberPad = memo(function NumberPad({
  onNumberClick,
  disabled,
}: NumberPadProps) {
  return (
    <div
      className="grid grid-cols-9 gap-1 md:hidden"
      aria-label="On-screen number pad"
    >
      {NUMBERS.map((num) => (
        <Button
          key={`pad-${num}`}
          variant="outline"
          size="icon"
          className="aspect-square h-auto w-full text-lg"
          onClick={() => onNumberClick(num)}
          disabled={disabled}
          aria-label={`Enter number ${num}`}
        >
          {num}
        </Button>
      ))}
    </div>
  )
})
