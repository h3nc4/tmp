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

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { validateBoard } from '@/lib/utils'
import SolverWorker from '@/solver.worker?worker'

const BOARD_SIZE = 81
const EMPTY_BOARD = Array(BOARD_SIZE).fill(null)

/**
 * A custom hook to manage the state and logic of the Sudoku board.
 * It handles board state, user input, and solver interaction via a Web Worker.
 *
 * @returns An object containing the board state and functions to interact with it.
 */
export function useSudoku() {
  const [board, setBoard] = useState<(number | null)[]>(EMPTY_BOARD)
  const [initialBoard, setInitialBoard] =
    useState<(number | null)[]>(EMPTY_BOARD)
  const [isSolving, setIsSolving] = useState(false)
  const [isSolved, setIsSolved] = useState(false)
  const [conflicts, setConflicts] = useState<Set<number>>(new Set())
  const [activeCellIndex, setActiveCellIndex] = useState<number | null>(null)
  const [solveFailed, setSolveFailed] = useState(false)
  const workerRef = useRef<Worker | null>(null)

  // Initialize and terminate the Web Worker.
  useEffect(() => {
    try {
      workerRef.current = new SolverWorker()

      const handleWorkerMessage = (
        event: MessageEvent<
          { type: 'solution' | 'error'; solution?: string; error?: string }
        >,
      ) => {
        const { type, solution, error } = event.data

        if (type === 'solution' && solution) {
          const solvedBoard = solution
            .split('')
            .map((char) => parseInt(char, 10))
          setBoard(solvedBoard)
          setIsSolved(true)
          setConflicts(new Set())
          setSolveFailed(false)
          toast.success('Sudoku solved successfully!')
        } else if (type === 'error' && error) {
          console.error('Solver worker error:', error)
          setSolveFailed(true)
          toast.error(`Solving failed: ${error}`)
        }
        setIsSolving(false)
      }

      workerRef.current.addEventListener('message', handleWorkerMessage)
    } catch (error) {
      console.error('Failed to initialize solver worker:', error)
      workerRef.current = null
      toast.error('Solver functionality is unavailable.');
    }

    // Terminate the worker when the component unmounts.
    return () => {
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [])

  // Solve conflicts whenever the board changes, unless it's already solved.
  useEffect(() => {
    if (!isSolved) {
      setConflicts(validateBoard(board))
    }
  }, [board, isSolved])

  /**
   * Updates the value of a single cell on the board.
   * @param index - The index of the cell to update (0-80).
   * @param value - The new value (1-9) or null to clear the cell.
   */
  const setCellValue = useCallback((index: number, value: number | null) => {
    if (index < 0 || index >= BOARD_SIZE) return

    setBoard((prevBoard) => {
      const newBoard = [...prevBoard]
      newBoard[index] = value
      return newBoard
    })

    // When user interacts, the 'solved' and 'failed' states are no longer valid.
    setIsSolved(false)
    setSolveFailed(false)
  }, [])

  /**
   * Clears all cells on the board, resetting it to an empty state.
   */
  const clearBoard = useCallback(() => {
    setBoard(EMPTY_BOARD)
    setInitialBoard(EMPTY_BOARD)
    setConflicts(new Set())
    setIsSolved(false)
    setSolveFailed(false)
    setActiveCellIndex(null)
    toast.info('Board cleared.')
  }, [])

  /**
   * Solves the current Sudoku puzzle using the Web Worker.
   */
  const solve = useCallback(() => {
    // Ensure the worker is available before trying to post a message.
    if (!workerRef.current) {
      toast.error('Solver worker is not available.')
      return
    }

    const currentConflicts = validateBoard(board)
    if (currentConflicts.size > 0) {
      toast.error('Cannot solve with conflicts. Please correct the cells.')
      setConflicts(currentConflicts)
      return
    }

    setIsSolving(true)
    setIsSolved(false)
    setSolveFailed(false)
    setInitialBoard(board)

    const boardString = board.map((cell) => cell ?? '.').join('')

    // Post the board to the worker to start solving.
    workerRef.current.postMessage({ boardString })
  }, [board])

  return {
    board,
    initialBoard,
    isSolving,
    isSolved,
    conflicts,
    activeCellIndex,
    solveFailed,
    setActiveCellIndex,
    setCellValue,
    clearBoard,
    solve,
  }
}
