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

import { useContext } from 'react'
import {
  SudokuStateContext,
  SudokuDispatchContext,
} from './sudoku.context'

/**
 * Custom hook to access the Sudoku game state.
 * @returns The current Sudoku state.
 * @throws An error if used outside of a SudokuProvider.
 */
export function useSudokuState() {
  const context = useContext(SudokuStateContext)
  if (context === undefined) {
    throw new Error('useSudokuState must be used within a SudokuProvider')
  }
  return context
}

/**
 * Custom hook to access the dispatch function for Sudoku actions.
 * @returns The dispatch function.
 * @throws An error if used outside of a SudokuProvider.
 */
export function useSudokuDispatch() {
  const context = useContext(SudokuDispatchContext)
  if (context === undefined) {
    throw new Error('useSudokuDispatch must be used within a SudokuProvider')
  }
  return context
}
