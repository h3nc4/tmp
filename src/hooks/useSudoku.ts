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

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { toast } from 'sonner'
import { validateBoard, getRelatedCellIndices, isMoveValid } from '@/lib/utils'
import SolverWorker from '@/solver.worker?worker'

const BOARD_SIZE = 81

/**
 * Represents the state of a single cell on the Sudoku board.
 * It can hold a definitive value or sets of pencil marks.
 */
export interface CellState {
  readonly value: number | null
  readonly candidates: ReadonlySet<number>
  readonly centers: ReadonlySet<number>
}

export type BoardState = readonly CellState[]
export type InputMode = 'normal' | 'candidate' | 'center'

/**
 * Creates an empty Sudoku board with the new cell state structure.
 * @returns An array of 81 empty cell states.
 */
const createEmptyBoard = (): BoardState =>
  Array(BOARD_SIZE).fill({
    value: null,
    candidates: new Set(),
    centers: new Set(),
  })

/**
 * A custom hook to manage the state and logic of the Sudoku board.
 * It handles board state, user input, solver interaction via a Web Worker,
 * undo/redo history, and derives UI state like button enablement and tooltips.
 *
 * @returns An object containing the board state and functions to interact with it.
 */
export function useSudoku() {
  const [history, setHistory] = useState([createEmptyBoard()])
  const [historyIndex, setHistoryIndex] = useState(0)
  const board = history[historyIndex]

  const [initialBoard, setInitialBoard] = useState<BoardState>(
    createEmptyBoard(),
  )
  const [isSolving, setIsSolving] = useState(false)
  const [isSolved, setIsSolved] = useState(false)
  const [conflicts, setConflicts] = useState<Set<number>>(new Set())
  const [activeCellIndex, setActiveCellIndex] = useState<number | null>(null)
  const [solveFailed, setSolveFailed] = useState(false)
  const [inputMode, setInputMode] = useState<InputMode>('normal')
  const workerRef = useRef<Worker | null>(null)

  const updateBoard = useCallback(
    (newBoard: BoardState) => {
      const newHistory = history.slice(0, historyIndex + 1)
      newHistory.push(newBoard)
      setHistory(newHistory)
      setHistoryIndex(newHistory.length - 1)

      // Any user action invalidates these states
      setIsSolved(false)
      setSolveFailed(false)
    },
    [history, historyIndex],
  )

  // Initialize and terminate the Web Worker.
  useEffect(() => {
    try {
      workerRef.current = new SolverWorker()

      const handleWorkerMessage = (
        event: MessageEvent<{
          type: 'solution' | 'error'
          solution?: string
          error?: string
        }>,
      ) => {
        const { type, solution, error } = event.data

        if (type === 'solution' && solution) {
          const solvedBoardArray = solution
            .split('')
            .map((char) => parseInt(char, 10))

          const newBoard = board.map((cell, index) => ({
            ...cell,
            value: solvedBoardArray[index],
          }))

          updateBoard(newBoard)
          setIsSolved(true)
          setConflicts(new Set())
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
      toast.error('Solver functionality is unavailable.')
    }

    return () => {
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [board, updateBoard])

  useEffect(() => {
    if (!isSolved) {
      setConflicts(validateBoard(board))
    }
  }, [board, isSolved])

  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1

  const isBoardEmpty = useMemo(
    () =>
      board.every(
        (cell) =>
          cell.value === null &&
          cell.candidates.size === 0 &&
          cell.centers.size === 0,
      ),
    [board],
  )
  const hasValues = useMemo(() => board.some((cell) => cell.value !== null), [
    board,
  ])
  const isBoardFull = useMemo(() => board.every((cell) => cell.value !== null), [
    board,
  ])
  const hasConflicts = conflicts.size > 0

  const isSolveDisabled =
    isSolving || !hasValues || isBoardFull || hasConflicts || solveFailed

  const isClearDisabled = isSolving || isBoardEmpty

  const solveButtonTitle = useMemo(() => {
    if (hasConflicts) return 'Cannot solve with conflicts.'
    if (isBoardFull) return 'Board is already full.'
    if (!hasValues) return 'Board is empty.'
    if (solveFailed)
      return 'Solving failed. Please change the board to try again.'
    return 'Solve the puzzle'
  }, [hasValues, isBoardFull, hasConflicts, solveFailed])

  const clearButtonTitle = useMemo(() => {
    if (isBoardEmpty) return 'Board is already empty.'
    return 'Clear the board'
  }, [isBoardEmpty])

  const undo = useCallback(() => {
    if (canUndo) {
      setHistoryIndex(historyIndex - 1)
    }
  }, [canUndo, historyIndex])

  const redo = useCallback(() => {
    if (canRedo) {
      setHistoryIndex(historyIndex + 1)
    }
  }, [canRedo, historyIndex])

  const setCellValue = useCallback(
    (index: number, value: number) => {
      if (index < 0 || index >= BOARD_SIZE) return

      const newBoard = board.map((cell) => ({
        value: cell.value,
        candidates: new Set(cell.candidates),
        centers: new Set(cell.centers),
      }))

      // Set new value and clear pencil marks in the cell
      newBoard[index] = {
        value,
        candidates: new Set(),
        centers: new Set(),
      }

      // Auto-remove pencil marks from related cells
      const relatedIndices = getRelatedCellIndices(index)
      relatedIndices.forEach((relatedIndex) => {
        newBoard[relatedIndex].candidates.delete(value)
        newBoard[relatedIndex].centers.delete(value)
      })

      updateBoard(newBoard)
    },
    [board, updateBoard],
  )

  const togglePencilMark = useCallback(
    (index: number, markValue: number, mode: InputMode) => {
      const cell = board[index]
      if (cell.value !== null) return // Can't add marks to a filled cell

      if (!isMoveValid(board, index, markValue)) {
        toast.error(
          `Cannot add pencil mark for ${markValue}, it conflicts with a number on the board.`,
        )
        return
      }

      const newBoard = board.map((c) => ({
        value: c.value,
        candidates: new Set(c.candidates),
        centers: new Set(c.centers),
      }))
      const targetCell = newBoard[index]

      if (mode === 'candidate') {
        if (targetCell.centers.size > 0) return // Block candidate if center exists
        targetCell.candidates.has(markValue)
          ? targetCell.candidates.delete(markValue)
          : targetCell.candidates.add(markValue)
      } else if (mode === 'center') {
        targetCell.candidates.clear() // Center replaces candidate
        targetCell.centers.has(markValue)
          ? targetCell.centers.delete(markValue)
          : targetCell.centers.add(markValue)
      }

      updateBoard(newBoard)
    },
    [board, updateBoard],
  )

  const eraseCell = useCallback(
    (index: number) => {
      if (index < 0 || index >= BOARD_SIZE) return

      const newBoard = board.map((cell, i) =>
        i === index
          ? {
            value: null,
            candidates: new Set<number>(),
            centers: new Set<number>(),
          }
          : cell,
      )
      updateBoard(newBoard)
    },
    [board, updateBoard],
  )

  const clearBoard = useCallback(() => {
    updateBoard(createEmptyBoard())
    setInitialBoard(createEmptyBoard())
    setConflicts(new Set())
    setActiveCellIndex(null)
    toast.info('Board cleared.')
  }, [updateBoard])

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
    setInitialBoard(board)

    const boardString = board.map((cell) => cell.value ?? '.').join('')

    // Post the board to the worker to start solving.
    workerRef.current.postMessage({ boardString })
  }, [board])

  return {
    /** The current state of the 81 Sudoku cells. */
    board,
    /** The board state as it was when the solver was last initiated. Used to highlight initial numbers. */
    initialBoard,
    /** True if the solver Web Worker is currently processing a puzzle. */
    isSolving,
    /** True if the board has been successfully solved by the solver. */
    isSolved,
    /** A set of indices of cells that currently have conflicting values. */
    conflicts,
    /** The index of the currently active/focused cell. */
    activeCellIndex,
    /** The current input mode ('normal', 'candidate', or 'center'). */
    inputMode,
    /** True if the last solve attempt failed. */
    solveFailed,
    /** True if the solve button should be disabled. */
    isSolveDisabled,
    /** True if the clear button should be disabled. */
    isClearDisabled,
    /** The tooltip text for the solve button. */
    solveButtonTitle,
    /** The tooltip text for the clear button. */
    clearButtonTitle,
    /** True if an undo operation is available. */
    canUndo,
    /** True if a redo operation is available. */
    canRedo,
    /** Sets the active cell index. */
    setActiveCellIndex,
    /** Sets the current input mode. */
    setInputMode,
    /** Sets the definitive value of a cell and clears related pencil marks. */
    setCellValue,
    /** Toggles a pencil mark (candidate or center) on a cell. */
    togglePencilMark,
    /** Clears all values and pencil marks from a single cell. */
    eraseCell,
    /** Clears the entire board and resets its state. */
    clearBoard,
    /** Initiates the Sudoku solver via the Web Worker. */
    solve,
    /** Reverts the board to its previous state in the history. */
    undo,
    /** Advances the board to the next state in the history. */
    redo,
  }
}
