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
export type GameMode = 'playing' | 'visualizing'

export interface Placement {
  index: number
  value: number
}

export interface Elimination {
  index: number
  value: number
}

export interface CauseCell {
  index: number
  candidates: number[]
}

export interface SolvingStep {
  technique: string
  placements: Placement[]
  eliminations: Elimination[]
  cause: CauseCell[]
}

export interface SolveResult {
  steps: SolvingStep[]
  solution: string | null
}

export interface HistoryState {
  readonly stack: readonly BoardState[]
  readonly index: number
}

export interface UiState {
  readonly activeCellIndex: number | null
  readonly highlightedValue: number | null
  readonly inputMode: InputMode
  readonly lastError: string | null
}

export interface SolverState {
  readonly isSolving: boolean
  readonly isSolved: boolean
  readonly solveFailed: boolean
  readonly gameMode: GameMode
  readonly steps: readonly SolvingStep[]
  readonly currentStepIndex: number | null
  readonly visualizationBoard: BoardState | null
  readonly candidatesForViz: (ReadonlySet<number> | null)[] | null
  readonly eliminationsForViz: readonly Elimination[] | null
}

export interface DerivedState {
  readonly conflicts: ReadonlySet<number>
  readonly isBoardEmpty: boolean
  readonly isBoardFull: boolean
}

/** The complete state of the Sudoku game. */
export interface SudokuState {
  /** The current state of the 81 Sudoku cells. */
  readonly board: BoardState
  /** The board state as it was when the solver was last initiated. */
  readonly initialBoard: BoardState
  /** A history of board states for undo/redo functionality. */
  readonly history: HistoryState
  /** The current state of the UI. */
  readonly ui: UiState
  /** The current state related to the solver and visualization. */
  readonly solver: SolverState
  /** State that is calculated based on the current board. */
  readonly derived: DerivedState
}

/** The shape of the game state object saved to local storage. */
export interface SavedGameState {
  history: {
    stack: BoardState[]
    index: number
  }
}
