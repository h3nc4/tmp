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

use serde::Serialize;

/// The final result of the solver, sent to the UI.
#[derive(Serialize, Clone)]
pub struct SolveResult {
    /// A list of logical steps taken to solve the puzzle.
    pub steps: Vec<SolvingStep>,
    /// The final, fully solved board as an 81-character string.
    pub solution: Option<String>,
}

/// A single logical step in solving the puzzle.
#[derive(Serialize, Clone)]
pub struct SolvingStep {
    /// The name of the technique used (e.g., "NakedSingle").
    pub technique: String,
    /// A list of numbers placed on the board in this step.
    pub placements: Vec<Placement>,
    /// A list of candidates eliminated from cells in this step.
    pub eliminations: Vec<Elimination>,
    /// The cells that form the basis of the logical deduction.
    pub cause: Vec<CauseCell>,
}

/// A number placed in a cell.
#[derive(Serialize, Clone)]
pub struct Placement {
    pub index: usize,
    pub value: u8,
}

/// A candidate eliminated from a cell.
#[derive(Serialize, Clone)]
pub struct Elimination {
    pub index: usize,
    pub value: u8,
}

/// A cell that is part of the cause of a logical deduction.
#[derive(Serialize, Clone)]
pub struct CauseCell {
    pub index: usize,
    /// The candidates in this cell that are relevant to the deduction.
    /// For a Naked Pair of {1, 8}, this would be `vec![1, 8]`.
    pub candidates: Vec<u8>,
}
