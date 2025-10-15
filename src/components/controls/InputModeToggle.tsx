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

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  useSudokuState,
  useSudokuDispatch,
} from '@/context/sudoku.hooks'
import { setInputMode } from '@/context/sudoku.actions'
import type { InputMode } from '@/context/sudoku.types'

/**
 * A toggle group for switching between Normal, Candidate, and Center input modes.
 */
export function InputModeToggle() {
  const { inputMode } = useSudokuState()
  const dispatch = useSudokuDispatch()

  const handleModeChange = (value: string) => {
    if (value) {
      dispatch(setInputMode(value as InputMode))
    }
  }

  return (
    <ToggleGroup
      type="single"
      value={inputMode}
      onValueChange={handleModeChange}
      className="flex-1"
      aria-label="Input Mode"
    >
      <ToggleGroupItem
        value="normal"
        className="flex-1"
        onMouseDown={(e) => e.preventDefault()}
      >
        Normal
      </ToggleGroupItem>
      <ToggleGroupItem
        value="candidate"
        className="flex-1"
        onMouseDown={(e) => e.preventDefault()}
      >
        Candidate
      </ToggleGroupItem>
      <ToggleGroupItem
        value="center"
        className="flex-1"
        onMouseDown={(e) => e.preventDefault()}
      >
        Center
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
