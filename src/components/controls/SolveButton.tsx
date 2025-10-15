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

import { useMemo, useState, useEffect, useRef } from 'react'
import { BrainCircuit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  useSudokuState,
  useSudokuDispatch,
} from '@/context/sudoku.hooks'
import { solveStart } from '@/context/sudoku.actions'

/**
 * A button that triggers the Sudoku solver.
 * It derives its enabled/disabled state and tooltip from the global context.
 */
export function SolveButton() {
  const { isSolving, solveFailed, conflicts, isBoardEmpty, isBoardFull } =
    useSudokuState()
  const dispatch = useSudokuDispatch()

  const [isShowingSolvingState, setIsShowingSolvingState] = useState(false)
  const solveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isSolveDisabled =
    isSolving || isBoardEmpty || isBoardFull || conflicts.size > 0 || solveFailed

  const solveButtonTitle = useMemo(() => {
    if (conflicts.size > 0) return 'Cannot solve with conflicts.'
    if (isBoardFull) return 'Board is already full.'
    if (isBoardEmpty) return 'Board is empty.'
    if (solveFailed)
      return 'Solving failed. Please change the board to try again.'
    return 'Solve the puzzle'
  }, [isBoardEmpty, isBoardFull, conflicts.size, solveFailed])

  useEffect(() => {
    if (isSolving) {
      solveTimerRef.current = setTimeout(() => {
        setIsShowingSolvingState(true)
      }, 500)
    } else {
      if (solveTimerRef.current) {
        clearTimeout(solveTimerRef.current)
      }
      setIsShowingSolvingState(false)
    }
    return () => {
      if (solveTimerRef.current) {
        clearTimeout(solveTimerRef.current)
      }
    }
  }, [isSolving])

  const handleSolve = () => {
    dispatch(solveStart())
  }

  return (
    <Button
      onClick={handleSolve}
      className="flex-1"
      disabled={isSolveDisabled}
      title={solveButtonTitle}
    >
      {isShowingSolvingState ? (
        <>
          <BrainCircuit className="mr-2 size-4 animate-pulse" />
          Solving...
        </>
      ) : (
        'Solve Puzzle'
      )}
    </Button>
  )
}
