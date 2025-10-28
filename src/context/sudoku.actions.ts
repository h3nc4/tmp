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

import type {
  SetCellValueAction,
  TogglePencilMarkAction,
  EraseCellAction,
  ClearBoardAction,
  UndoAction,
  RedoAction,
  SolveStartAction,
  SolveSuccessAction,
  SolveFailureAction,
  SetActiveCellAction,
  SetInputModeAction,
  ClearErrorAction,
  SetHighlightedValueAction,
  ViewSolverStepAction,
  ExitVisualizationAction,
  ImportBoardAction,
  GeneratePuzzleStartAction,
  GeneratePuzzleSuccessAction,
  GeneratePuzzleFailureAction,
} from './sudoku.actions.types'
import type { InputMode, SolveResult } from './sudoku.types'

/** Creates an action to set the definitive value of a cell. */
export const setCellValue = (index: number, value: number): SetCellValueAction => ({
  type: 'SET_CELL_VALUE',
  index,
  value,
})

/** Creates an action to toggle a pencil mark in a cell. */
export const togglePencilMark = (
  index: number,
  value: number,
  mode: 'candidate' | 'center',
): TogglePencilMarkAction => ({
  type: 'TOGGLE_PENCIL_MARK',
  index,
  value,
  mode,
})

/** Creates an action to erase the contents of a cell. */
export const eraseCell = (index: number): EraseCellAction => ({
  type: 'ERASE_CELL',
  index,
})

/** Creates an action to clear the entire board. */
export const clearBoard = (): ClearBoardAction => ({
  type: 'CLEAR_BOARD',
})

/** Creates an action to replace the current board with an imported one. */
export const importBoard = (boardString: string): ImportBoardAction => ({
  type: 'IMPORT_BOARD',
  boardString,
})

/** Creates an action to undo the last move. */
export const undo = (): UndoAction => ({
  type: 'UNDO',
})

/** Creates an action to redo the last undone move. */
export const redo = (): RedoAction => ({
  type: 'REDO',
})

/** Creates an action to signal the start of the solving process. */
export const solveStart = (): SolveStartAction => ({
  type: 'SOLVE_START',
})

/** Creates an action to signal a successful solve. */
export const solveSuccess = (result: SolveResult): SolveSuccessAction => ({
  type: 'SOLVE_SUCCESS',
  result,
})

/** Creates an action to signal a failed solve attempt. */
export const solveFailure = (): SolveFailureAction => ({
  type: 'SOLVE_FAILURE',
})

/** Creates an action to signal the start of the puzzle generation process. */
export const generatePuzzleStart = (difficulty: string): GeneratePuzzleStartAction => ({
  type: 'GENERATE_PUZZLE_START',
  difficulty,
})

/** Creates an action for when the generator successfully creates a puzzle. */
export const generatePuzzleSuccess = (puzzleString: string): GeneratePuzzleSuccessAction => ({
  type: 'GENERATE_PUZZLE_SUCCESS',
  puzzleString,
})

/** Creates an action for when the puzzle generator fails. */
export const generatePuzzleFailure = (): GeneratePuzzleFailureAction => ({
  type: 'GENERATE_PUZZLE_FAILURE',
})

/** Creates an action to set the active cell. */
export const setActiveCell = (index: number | null): SetActiveCellAction => ({
  type: 'SET_ACTIVE_CELL',
  index,
})

/** Creates an action to change the input mode. */
export const setInputMode = (mode: InputMode): SetInputModeAction => ({
  type: 'SET_INPUT_MODE',
  mode,
})

/** Creates an action to clear the last error message. */
export const clearError = (): ClearErrorAction => ({
  type: 'CLEAR_ERROR',
})

/** Creates an action to set the highlighted number value. */
export const setHighlightedValue = (value: number | null): SetHighlightedValueAction => ({
  type: 'SET_HIGHLIGHTED_VALUE',
  value,
})

/** Creates an action to view a specific step from the solver. */
export const viewSolverStep = (index: number): ViewSolverStepAction => ({
  type: 'VIEW_SOLVER_STEP',
  index,
})

/** Creates an action to exit visualization mode and return to playing. */
export const exitVisualization = (): ExitVisualizationAction => ({
  type: 'EXIT_VISUALIZATION',
})
