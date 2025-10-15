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

/** The complete state of the Sudoku game. */
export interface SudokuState {
  /** The current state of the 81 Sudoku cells. */
  readonly board: BoardState
  /** The board state as it was when the solver was last initiated. */
  readonly initialBoard: BoardState
  /** A history of board states for undo/redo functionality. */
  readonly history: readonly BoardState[]
  /** The current position within the history array. */
  readonly historyIndex: number
  /** True if the solver Web Worker is currently processing a puzzle. */
  readonly isSolving: boolean
  /** True if the board has been successfully solved by the solver. */
  readonly isSolved: boolean
  /** True if the last solve attempt failed. */
  readonly solveFailed: boolean
  /** The index of the currently active/focused cell. */
  readonly activeCellIndex: number | null
  /** The current input mode ('normal', 'candidate', or 'center'). */
  readonly inputMode: InputMode
  /** A set of indices for cells with conflicting values. */
  readonly conflicts: ReadonlySet<number>
  /** True if the board has no numbers. */
  readonly isBoardEmpty: boolean
  /** True if every cell on the board has a number. */
  readonly isBoardFull: boolean
  /** A message for the last user-facing error, used for toasts. */
  readonly lastError: string | null
}

/** The shape of the game state object saved to local storage. */
export interface SavedGameState {
  history: BoardState[]
  historyIndex: number
}
