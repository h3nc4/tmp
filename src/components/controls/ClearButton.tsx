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

import { useMemo } from 'react'
import { Eraser } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSudokuState } from '@/context/sudoku.hooks'
import { useSudokuActions } from '@/hooks/useSudokuActions'
import { toast } from 'sonner'

/**
 * A button to clear the entire Sudoku board.
 * It derives its enabled/disabled state from the global context.
 */
export function ClearButton() {
  const { solver, derived } = useSudokuState()
  const { clearBoard } = useSudokuActions()

  const isClearDisabled = solver.isSolving || derived.isBoardEmpty

  const clearButtonTitle = useMemo(() => {
    if (derived.isBoardEmpty) return 'Board is already empty.'
    return 'Clear the board'
  }, [derived.isBoardEmpty])

  const handleClear = () => {
    clearBoard()
    toast.info('Board cleared.')
  }

  return (
    <Button
      variant="secondary"
      onClick={handleClear}
      className="flex-1"
      disabled={isClearDisabled}
      title={clearButtonTitle}
      onMouseDown={(e) => e.preventDefault()}
    >
      <Eraser className="mr-2 size-4" />
      Clear Board
    </Button>
  )
}
