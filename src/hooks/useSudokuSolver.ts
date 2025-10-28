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
import {
  solveSuccess,
  solveFailure,
  generatePuzzleSuccess,
  generatePuzzleFailure,
} from '@/context/sudoku.actions'
import SolverWorker from '@/workers/sudoku.worker?worker'

const WORKER_UNAVAILABLE_ERROR = 'Solver functionality is unavailable.'

/**
 * Manages the Sudoku solver Web Worker. It handles initializing the worker,
 * posting tasks to it (solving, generating), and dispatching actions based
 * on the worker's response (success or error).
 *
 * @param state - The current Sudoku state.
 * @param dispatch - The dispatch function from the Sudoku reducer.
 */
export function useSudokuSolver(state: SudokuState, dispatch: Dispatch<SudokuAction>) {
  const workerRef = useRef<Worker | null>(null)
  const { isSolving, isGenerating, generationDifficulty } = state.solver
  const { board } = state

  // Effect for managing the worker's lifecycle.
  useEffect(() => {
    try {
      workerRef.current = new SolverWorker()
    } catch (error) {
      console.error('Failed to initialize solver worker:', error)
      toast.error(WORKER_UNAVAILABLE_ERROR)
    }

    // Cleanup: terminate the worker on unmount.
    return () => {
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, []) // Empty dependency array ensures this runs only on mount/unmount.

  // Effect for handling messages from the worker.
  useEffect(() => {
    const worker = workerRef.current
    if (!worker) return

    const handleWorkerMessage = (
      event: MessageEvent<{
        type: 'solution' | 'puzzle_generated' | 'error'
        result?: SolveResult
        puzzleString?: string
        error?: string
      }>,
    ) => {
      const { type, result, puzzleString, error } = event.data

      if (type === 'solution' && result) {
        dispatch(solveSuccess(result))
        toast.success('Sudoku solved successfully!')
      } else if (type === 'puzzle_generated' && puzzleString) {
        dispatch(generatePuzzleSuccess(puzzleString))
        toast.success('New puzzle generated!')
      } else if (type === 'error' && error) {
        console.error('Solver worker error:', error)
        if (isSolving) dispatch(solveFailure())
        if (isGenerating) dispatch(generatePuzzleFailure())
        toast.error(`Operation failed: ${error}`)
      }
    }

    worker.addEventListener('message', handleWorkerMessage)
    return () => {
      worker.removeEventListener('message', handleWorkerMessage)
    }
  }, [dispatch, isSolving, isGenerating])

  // Effect to trigger the solver.
  useEffect(() => {
    if (isSolving) {
      if (!workerRef.current) {
        toast.error(WORKER_UNAVAILABLE_ERROR)
        dispatch(solveFailure())
        return
      }
      const boardString = board.map((cell) => cell.value ?? '.').join('')
      workerRef.current.postMessage({ type: 'solve', boardString })
    }
  }, [isSolving, board, dispatch])

  // Effect to trigger the puzzle generator.
  useEffect(() => {
    if (isGenerating && generationDifficulty) {
      if (!workerRef.current) {
        toast.error(WORKER_UNAVAILABLE_ERROR)
        dispatch(generatePuzzleFailure())
        return
      }
      workerRef.current.postMessage({
        type: 'generate',
        difficulty: generationDifficulty,
      })
    }
  }, [isGenerating, generationDifficulty, dispatch])
}
