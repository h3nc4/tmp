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

import React, { useReducer } from 'react'
import { sudokuReducer, loadInitialState } from './sudoku.reducer'
import { useSudokuPersistence } from '@/hooks/useSudokuPersistence'
import { useSudokuSolver } from '@/hooks/useSudokuSolver'
import { useSudokuFeedback } from '@/hooks/useSudokuFeedback'
import { SudokuDispatchContext, SudokuStateContext } from './sudoku.context'

type SudokuProviderProps = {
  readonly children: React.ReactNode
}

/**
 * Provides the Sudoku game state and dispatch function to its children.
 * It initializes the state, manages side effects like persistence and
 * solver interaction, and makes them available throughout the component tree.
 */
export function SudokuProvider({ children }: SudokuProviderProps) {
  const [state, dispatch] = useReducer(sudokuReducer, undefined, loadInitialState)

  // Custom hooks to manage side effects, driven by state changes.
  useSudokuPersistence(state)
  useSudokuSolver(state, dispatch)
  useSudokuFeedback(state, dispatch)

  return (
    <SudokuStateContext.Provider value={state}>
      <SudokuDispatchContext.Provider value={dispatch}>{children}</SudokuDispatchContext.Provider>
    </SudokuStateContext.Provider>
  )
}
