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

import { useEffect, type Dispatch } from 'react'
import { toast } from 'sonner'
import type { SudokuAction } from '@/context/sudoku.actions.types'
import type { SudokuState } from '@/context/sudoku.types'
import { clearError } from '@/context/sudoku.actions'

/**
 * Manages user-facing feedback, such as toasts for errors. It listens for changes
 * in the `lastError` state property and displays a toast when an error is set.
 *
 * @param state - The current Sudoku state.
 * @param dispatch - The dispatch function from the Sudoku reducer.
 */
export function useSudokuFeedback(state: SudokuState, dispatch: Dispatch<SudokuAction>) {
  const { lastError } = state.ui

  useEffect(() => {
    if (lastError) {
      toast.error(lastError)
      dispatch(clearError())
    }
  }, [lastError, dispatch])
}
