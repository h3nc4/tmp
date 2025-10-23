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
import { toast } from 'sonner'
import {
  useSudokuState,
  useSudokuDispatch,
} from '@/context/sudoku.hooks'
import * as actions from '@/context/sudoku.actions'
import { isMoveValid, boardStateToString } from '@/lib/utils'
import type { InputMode } from '@/context/sudoku.types'

/**
 * A hook that provides a stable, memoized API for dispatching all Sudoku actions.
 * This hook acts as the "intent interpretation" layer, translating high-level
 * user actions into the specific low-level mutations that are sent to the reducer.
 *
 * @returns An object containing functions to dispatch all possible user intents.
 */
export function useSudokuActions() {
  const state = useSudokuState()
  const dispatch = useSudokuDispatch()

  // useMemo ensures that the returned object has a stable identity,
  // preventing unnecessary re-renders in components that consume this hook.
  return useMemo(
    () => ({
      /** Sets the active cell and updates the highlighted value. */
      setActiveCell: (index: number | null) => {
        dispatch(actions.setActiveCell(index))
      },

      /** Inputs a value, respecting the current input mode. */
      inputValue: (value: number) => {
        if (state.ui.activeCellIndex === null) return

        if (state.ui.inputMode === 'normal') {
          dispatch(actions.setCellValue(state.ui.activeCellIndex, value))
          // Auto-advance focus if the move was valid
          if (
            isMoveValid(state.board, state.ui.activeCellIndex, value) &&
            state.ui.activeCellIndex < 80
          ) {
            dispatch(actions.setActiveCell(state.ui.activeCellIndex + 1))
          }
        } else {
          dispatch(
            actions.togglePencilMark(
              state.ui.activeCellIndex,
              value,
              state.ui.inputMode,
            ),
          )
        }
      },

      /** Navigates the grid from the active cell. */
      navigate: (direction: 'up' | 'down' | 'left' | 'right') => {
        if (state.ui.activeCellIndex === null) return
        let nextIndex = -1
        const { activeCellIndex } = state.ui

        if (direction === 'right' && activeCellIndex < 80) nextIndex = activeCellIndex + 1
        else if (direction === 'left' && activeCellIndex > 0) nextIndex = activeCellIndex - 1
        else if (direction === 'down' && activeCellIndex < 72) nextIndex = activeCellIndex + 9
        else if (direction === 'up' && activeCellIndex > 8) nextIndex = activeCellIndex - 9

        if (nextIndex !== -1) {
          dispatch(actions.setActiveCell(nextIndex))
        }
      },

      /** Erases the active cell's content, with different behaviors for delete/backspace. */
      eraseActiveCell: (mode: 'delete' | 'backspace') => {
        if (state.ui.activeCellIndex === null) return
        dispatch(actions.eraseCell(state.ui.activeCellIndex))

        if (mode === 'backspace' && state.ui.activeCellIndex > 0) {
          dispatch(actions.setActiveCell(state.ui.activeCellIndex - 1))
        }
      },

      /** Clears the entire board. */
      clearBoard: () => dispatch(actions.clearBoard()),
      /** Exports the current board state to the clipboard. */
      exportBoard: () => {
        if (!navigator.clipboard) {
          toast.error('Clipboard API not available in this browser or context.')
          return
        }
        const boardString = boardStateToString(state.board)
        navigator.clipboard
          .writeText(boardString)
          .then(() => {
            toast.success('Board exported to clipboard.')
          })
          .catch(() => {
            toast.error('Failed to copy board to clipboard.')
          })
      },
      /** Undoes the last move. */
      undo: () => dispatch(actions.undo()),
      /** Redoes the last undone move. */
      redo: () => dispatch(actions.redo()),
      /** Starts the solver. */
      solve: () => dispatch(actions.solveStart()),
      /** Exits the solver visualization mode. */
      exitVisualization: () => dispatch(actions.exitVisualization()),
      /** Changes the input mode. */
      setInputMode: (mode: InputMode) => dispatch(actions.setInputMode(mode)),
      /** Sets the globally highlighted number. */
      setHighlightedValue: (value: number | null) =>
        dispatch(actions.setHighlightedValue(value)),
      /** Jumps to a specific step in the solver visualization. */
      viewSolverStep: (index: number) =>
        dispatch(actions.viewSolverStep(index)),
    }),
    [state, dispatch],
  )
}
