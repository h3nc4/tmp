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
pub mod logical_solver;
pub mod solver;
pub mod types;
mod utils;

use board::Board;
use std::panic;
use types::SolveResult;
use wasm_bindgen::prelude::*;

/// Called when the wasm module is instantiated.
///
/// This function is executed automatically by the wasm-bindgen runtime
/// and is a good place to put initialization code, like setting up panic hooks.
#[wasm_bindgen(start)]
pub fn main() {
    utils::set_panic_hook();
}

/// Solves a Sudoku puzzle and returns the logical steps taken.
///
/// This function employs a hybrid strategy. It first applies logical solving
/// techniques to generate a series of human-readable steps. If the puzzle
/// is not fully solved by logic, it falls back to a high-speed
/// backtracking algorithm to find the solution.
///
/// ### Arguments
///
/// * `board_str` - A string slice representing the Sudoku board (81 chars, '.' or '0' for empty).
///
/// ### Returns
///
/// * `Ok(JsValue)` - A serialized `SolveResult` object containing the steps and an optional solution string.
/// * `Err(JsValue)` - An error if the input is invalid, the puzzle is unsolvable, or a crash occurs.
#[wasm_bindgen]
pub fn solve_sudoku(board_str: &str) -> Result<JsValue, JsValue> {
    let initial_board = Board::from_str(board_str).map_err(|e| JsValue::from_str(&e))?;

    let solve_result = panic::catch_unwind(move || {
        let (steps, mut board_after_logic) = logical_solver::solve_with_steps(&initial_board);

        // If logic was not sufficient, fall back to the backtracking algorithm.
        let final_solution = if board_after_logic.cells.contains(&0) {
            if solver::solve(&mut board_after_logic) {
                Some(board_after_logic.to_string()) // Solved with backtracking.
            } else {
                // This case indicates the logical steps led to an unsolvable state,
                // or the original puzzle was unsolvable.
                return None;
            }
        } else {
            // Logic was sufficient, the final board state is the solution.
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
