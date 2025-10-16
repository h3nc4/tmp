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

import type { BoardState, InputMode } from './sudoku.types'

// --- High-Level User Intent Actions ---

/** Action representing user inputting a number, to be interpreted by the reducer based on the current mode. */
export interface InputValueAction {
  type: 'INPUT_VALUE'
  value: number
}

/** Action for navigating the grid with arrow keys. */
export interface NavigateAction {
  type: 'NAVIGATE'
  direction: 'up' | 'down' | 'left' | 'right'
}

/** Action to erase the active cell, with a mode for backspace-like behavior. */
export interface EraseActiveCellAction {
  type: 'ERASE_ACTIVE_CELL'
  mode: 'delete' | 'backspace'
}

// --- Internal State Management Actions ---

/** Action to set the definitive value of a cell. */
export interface SetCellValueAction {
  type: 'SET_CELL_VALUE'
  index: number
  value: number
}

/** Action to add or remove a pencil mark (candidate or center). */
export interface TogglePencilMarkAction {
  type: 'TOGGLE_PENCIL_MARK'
  index: number
  value: number
  mode: 'candidate' | 'center'
}

/** Action to clear a single cell of its value and all pencil marks. */
export interface EraseCellAction {
  type: 'ERASE_CELL'
  index: number
}

/** Action to completely reset the board to an empty state. */
export interface ClearBoardAction {
  type: 'CLEAR_BOARD'
}

/** Action to revert to the previous state in history. */
export interface UndoAction {
  type: 'UNDO'
}

/** Action to advance to the next state in history. */
export interface RedoAction {
  type: 'REDO'
}

/** Action to begin the solving process. */
export interface SolveStartAction {
  type: 'SOLVE_START'
}

/** Action for when the solver successfully finds a solution. */
export interface SolveSuccessAction {
  type: 'SOLVE_SUCCESS'
  solution: BoardState
}

/** Action for when the solver fails to find a solution. */
export interface SolveFailureAction {
  type: 'SOLVE_FAILURE'
}

/** Action to set the currently focused/active cell. */
export interface SetActiveCellAction {
  type: 'SET_ACTIVE_CELL'
  index: number | null
}

/** Action to change the current input mode. */
export interface SetInputModeAction {
  type: 'SET_INPUT_MODE'
  mode: InputMode
}

/** Action to clear the last error message from the state. */
export interface ClearErrorAction {
  type: 'CLEAR_ERROR'
}

/** Action to set the number that should be highlighted across the board. */
export interface SetHighlightedValueAction {
  type: 'SET_HIGHLIGHTED_VALUE'
  value: number | null
}

/** A union of all possible actions that can be dispatched to the sudokuReducer. */
export type SudokuAction =
  | InputValueAction
  | NavigateAction
  | EraseActiveCellAction
  | SetCellValueAction
  | TogglePencilMarkAction
  | EraseCellAction
  | ClearBoardAction
  | UndoAction
  | RedoAction
  | SolveStartAction
  | SolveSuccessAction
  | SolveFailureAction
  | SetActiveCellAction
  | SetInputModeAction
  | ClearErrorAction
  | SetHighlightedValueAction
