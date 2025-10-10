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

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import init, { solve_sudoku } from 'wasudoku-wasm'

const BOARD_SIZE = 81
const EMPTY_BOARD = Array(BOARD_SIZE).fill(null)

/**
 * A custom hook to manage the state and logic of the Sudoku board.
 * It handles WASM initialization, board state, user input, and solver interaction.
 *
 * @returns An object containing the board state and functions to interact with it.
 */
export function useSudoku() {
  const [wasmReady, setWasmReady] = useState(false)
  const [board, setBoard] = useState<(number | null)[]>(EMPTY_BOARD)
  const [initialBoard, setInitialBoard] =
    useState<(number | null)[]>(EMPTY_BOARD)
  const [isSolving, setIsSolving] = useState(false)

  // Initialize the WebAssembly module on component mount.
  useEffect(() => {
    const loadWasm = async () => {
      try {
        await init()
        setWasmReady(true)
      } catch (e) {
        console.error('Failed to load WebAssembly module:', e)
        toast.error('Failed to load WASM solver module.')
      }
    }
    loadWasm()
  }, [])

  /**
   * Updates the value of a single cell on the board.
   * @param index - The index of the cell to update (0-80).
   * @param value - The new value (1-9) or null to clear the cell.
   */
  const setCellValue = useCallback(
    (index: number, value: number | null) => {
      if (index < 0 || index >= BOARD_SIZE) return
      const newBoard = [...board]
      newBoard[index] = value
      setBoard(newBoard)
    },
    [board],
  )

  /**
   * Clears all cells on the board, resetting it to an empty state.
   */
  const clearBoard = useCallback(() => {
    setBoard(EMPTY_BOARD)
    setInitialBoard(EMPTY_BOARD)
    toast.info('Board cleared.')
  }, [])

  /**
   * Solves the current Sudoku puzzle using the WASM module.
   */
  const solve = useCallback(async () => {
    if (!wasmReady) {
      toast.warning('Solver is not ready yet. Please wait.')
      return
    }

    setIsSolving(true)
    // The current board state becomes the "initial" puzzle for this solve attempt.
    setInitialBoard(board)

    // Convert board to string format for the solver ('.' for empty cells).
    const boardString = board.map((cell) => cell ?? '.').join('')

    // Yield to the event loop to allow the UI to update to the "solving" state.
    await new Promise((resolve) => setTimeout(resolve, 0))

    try {
      const solution = solve_sudoku(boardString)
      const solvedBoard = solution
        .split('')
        .map((char) => parseInt(char, 10))
      setBoard(solvedBoard)
      toast.success('Sudoku solved successfully!')
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      console.error('Solver error:', errorMessage)
      toast.error(`Solving failed: ${errorMessage}`)
    } finally {
      setIsSolving(false)
    }
  }, [wasmReady, board])

  return {
    wasmReady,
    board,
    initialBoard,
    isSolving,
    setCellValue,
    clearBoard,
    solve,
  }
}
