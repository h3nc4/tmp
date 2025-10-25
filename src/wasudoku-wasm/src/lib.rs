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

pub mod board;
pub mod generate;
pub mod logical_solver;
pub mod solver;
pub mod types;
mod utils;

use board::Board;
use generate::Difficulty;
use std::panic;
use types::SolveResult;
use wasm_bindgen::prelude::*;

/// Set the panic hook to forward Rust panics to the browser console.
#[wasm_bindgen(start)]
pub fn main() {
    utils::set_panic_hook();
}

/// Solve a Sudoku puzzle and return the logical steps and solution.
///
/// This function employs a hybrid strategy. It first applies logical solving
/// techniques to generate human-readable steps. If logic alone cannot solve
/// the puzzle, it falls back to a high-speed backtracking algorithm to find
/// the final solution.
///
/// ### Arguments
///
/// * `board_str` - An 81-character string representing the Sudoku board,
///   with `.` or `0` for empty cells.
///
/// ### Returns
///
/// * A `JsValue` containing the serialized `SolveResult`, which includes
///   the logical steps and an optional final solution string.
///
/// ### Errors
///
/// * A `JsValue` error if the input is invalid, the puzzle is unsolvable,
///   or a panic occurs in the underlying solver.
#[wasm_bindgen]
pub fn solve_sudoku(board_str: &str) -> Result<JsValue, JsValue> {
    let initial_board = Board::from_str(board_str).map_err(|e| JsValue::from_str(&e))?;

    // Use `catch_unwind` to contain any panics within the solver logic,
    // preventing the WASM module from crashing and allowing a graceful error return.
    let solve_result = panic::catch_unwind(move || {
        let (steps, mut board_after_logic) = logical_solver::solve_with_steps(&initial_board);

        // If logic was not sufficient, fall back to the backtracking algorithm.
        let final_solution = if board_after_logic.cells.contains(&0) {
            if solver::solve(&mut board_after_logic) {
                Some(board_after_logic.to_string())
            } else {
                return None;
            }
        } else {
            Some(board_after_logic.to_string())
        };

        Some(SolveResult {
            steps,
            solution: final_solution,
        })
    });

    match solve_result {
        Ok(Some(result)) => Ok(serde_wasm_bindgen::to_value(&result).unwrap()),
        Ok(None) => Err(JsValue::from_str("No solution found for the given puzzle.")),
        Err(_) => Err(JsValue::from_str("Solver crashed due to a critical error.")),
    }
}

/// Generate a new Sudoku puzzle with a unique solution.
///
/// ### Arguments
///
/// * `difficulty_str` - A string representing the desired difficulty:
///   "easy", "medium", "hard", or "extreme".
///
/// ### Returns
///
/// * A `String` containing the 81-character puzzle.
///
/// ### Errors
///
/// * A `JsValue` error if the difficulty string is invalid or if the
///   generator panics.
#[wasm_bindgen]
pub fn generate_sudoku(difficulty_str: &str) -> Result<String, JsValue> {
    let difficulty = match difficulty_str {
        "easy" => Difficulty::Easy,
        "medium" => Difficulty::Medium,
        "hard" => Difficulty::Hard,
        "extreme" => Difficulty::Extreme,
        _ => return Err(JsValue::from_str("Invalid difficulty level.")),
    };

    let result = panic::catch_unwind(|| generate::generate(difficulty));

    match result {
        Ok(board) => Ok(board.to_string()),
        Err(_) => Err(JsValue::from_str(
            "Generator crashed due to a critical error.",
        )),
    }
}
