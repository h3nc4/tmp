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

import { useEffect, useRef, type Dispatch } from 'react'
import { toast } from 'sonner'
import type { SudokuAction } from '@/context/sudoku.actions.types'
import type { SudokuState, SolveResult } from '@/context/sudoku.types'
import { solveSuccess, solveFailure } from '@/context/sudoku.actions'
import SolverWorker from '@/workers/sudoku.worker?worker'

/**
 * A hook to manage the Sudoku solver Web Worker. It handles initializing
 * the worker, posting the board to it when solving starts, and dispatching
 * actions based on the worker's response (success or error).
 *
 * @param state - The current Sudoku state.
 * @param dispatch - The dispatch function from the Sudoku reducer.
 */
export function useSudokuSolver(
  state: SudokuState,
  dispatch: Dispatch<SudokuAction>,
) {
  const workerRef = useRef<Worker | null>(null)
  const { isSolving } = state.solver
  const { board } = state

  // Effect for managing the worker's lifecycle.
  // This runs once on mount to create the worker and once on unmount to terminate it.
  useEffect(() => {
    try {
      workerRef.current = new SolverWorker()
    } catch (error) {
      console.error('Failed to initialize solver worker:', error)
      toast.error('Solver functionality is unavailable.')
      return
    }

    const handleWorkerMessage = (
      event: MessageEvent<{
        type: 'solution' | 'error'
        result?: SolveResult
        error?: string
      }>,
    ) => {
      const { type, result, error } = event.data

      if (type === 'solution' && result) {
        dispatch(solveSuccess(result))
        toast.success('Sudoku solved successfully!')
      } else if (type === 'error' && error) {
        console.error('Solver worker error:', error)
        dispatch(solveFailure())
        toast.error(`Solving failed: ${error}`)
      }
    }

    workerRef.current.addEventListener('message', handleWorkerMessage)

    // Terminate the worker on cleanup.
    return () => {
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [dispatch]) // Dispatch is stable, so this effect runs only once.

  // Effect to trigger the solver when isSolving becomes true.
  useEffect(() => {
    if (isSolving) {
      if (!workerRef.current) {
        toast.error('Solver worker is not available.')
        dispatch(solveFailure())
        return
      }
      const boardString = board.map((cell) => cell.value ?? '.').join('')
      workerRef.current.postMessage({ boardString })
    }
  }, [isSolving, board, dispatch])
}
