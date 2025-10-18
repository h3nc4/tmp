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

/// Represents the final result of the solver, to be sent to the frontend.
#[derive(Serialize)]
pub struct SolveResult {
    /// A list of logical steps taken to solve the puzzle.
    pub steps: Vec<SolvingStep>,
    /// The final, fully solved board as a string.
    pub solution: Option<String>,
}

/// Represents a single logical step in solving the puzzle.
#[derive(Serialize)]
pub struct SolvingStep {
    /// The name of the technique used (e.g., "NakedSingle").
    pub technique: String,
    /// A list of numbers placed on the board in this step.
    pub placements: Vec<Placement>,
    /// A list of candidates eliminated from cells in this step.
    pub eliminations: Vec<Elimination>,
    /// The cells that form the basis of the technique (e.g., the two cells of a Naked Pair).
    pub cause: Vec<CauseCell>,
}

/// Represents placing a single number in a cell.
#[derive(Serialize)]
pub struct Placement {
    pub index: usize,
    pub value: u8,
}

/// Represents eliminating a single candidate from a cell.
#[derive(Serialize)]
pub struct Elimination {
    pub index: usize,
    pub value: u8,
}

/// Represents a cell that is part of the cause of a logical deduction.
#[derive(Serialize)]
pub struct CauseCell {
    pub index: usize,
    pub candidates: Vec<u8>,
}
