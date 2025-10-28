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

import { createContext, type Dispatch } from 'react'
import type { SudokuState } from './sudoku.types'
import type { SudokuAction } from './sudoku.actions.types'

/** Context to provide the Sudoku game state to consumer components. */
export const SudokuStateContext = createContext<SudokuState | undefined>(undefined)

/** Context to provide the dispatch function for Sudoku actions. */
export const SudokuDispatchContext = createContext<Dispatch<SudokuAction> | undefined>(undefined)
