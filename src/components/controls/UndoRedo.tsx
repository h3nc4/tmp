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

import { Undo, Redo } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSudokuState } from '@/context/sudoku.hooks'
import { useSudokuActions } from '@/hooks/useSudokuActions'

/**
 * A component containing the Undo and Redo buttons.
 * It derives its enabled/disabled state from the global context.
 */
export function UndoRedo() {
  const { history, solver } = useSudokuState()
  const { undo, redo } = useSudokuActions()

  const isVisualizing = solver.gameMode === 'visualizing'
  const canUndo = history.index > 0 && !isVisualizing
  const canRedo = history.index < history.stack.length - 1 && !isVisualizing

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={undo}
        disabled={!canUndo}
        title="Undo"
        onMouseDown={(e) => e.preventDefault()}
      >
        <Undo />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={redo}
        disabled={!canRedo}
        title="Redo"
        onMouseDown={(e) => e.preventDefault()}
      >
        <Redo />
      </Button>
    </>
  )
}
