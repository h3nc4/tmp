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
mod utils;

use board::Board;
use std::panic;
use wasm_bindgen::prelude::*;

/// Called when the wasm module is instantiated.
///
/// This function is executed automatically by the wasm-bindgen runtime
/// and is a good place to put initialization code, like setting up panic hooks.
#[wasm_bindgen(start)]
pub fn main() {
    utils::set_panic_hook();
}

/// Solves a Sudoku puzzle represented as a string.
///
/// This function employs a hybrid strategy. It first applies logical solving
/// techniques (like naked/hidden singles) to reduce the puzzle. If the puzzle
/// is not fully solved by logic, it seamlessly falls back to a high-speed
/// backtracking algorithm to find the final solution.
///
/// ### Arguments
///
/// * `board_str` - A string slice representing the Sudoku board (81 chars, '.' or '0' for empty).
///
/// ### Returns
///
/// * `Ok(String)` - A string representing the solved board if a solution is found.
/// * `Err(JsValue)` - An error if the input is invalid, the puzzle is unsolvable, or a crash occurs.
#[wasm_bindgen]
pub fn solve_sudoku(board_str: &str) -> Result<String, JsValue> {
    // 1. Initial parsing and validation remains the same.
    let initial_board = Board::from_str(board_str).map_err(|e| JsValue::from_str(&e))?;

    // 2. The entire solving process, including logic and backtracking, is wrapped
    //    to catch any potential panics for safe error reporting to JavaScript.
    let solve_result = panic::catch_unwind(move || {
        // 3. Attempt to solve with logical techniques first.
        let mut logical_board = logical_solver::LogicalBoard::from_board(&initial_board);
        logical_solver::solve(&mut logical_board);

        // 4. Create a board suitable for the backtracking solver from the result.
        let mut board_after_logic = Board {
            cells: logical_board.cells,
        };

        // 5. Check if logic was sufficient. A solved board has no empty (0) cells.
        if !board_after_logic.cells.contains(&0) {
            return Some(board_after_logic);
        }

        // 6. If not fully solved, fall back to the backtracking algorithm.
        if solver::solve(&mut board_after_logic) {
            Some(board_after_logic) // Solved with backtracking.
        } else {
            None // No solution found even with backtracking.
        }
    });

    match solve_result {
        Ok(Some(solved_board)) => Ok(solved_board.to_string()),
        Ok(None) => Err(JsValue::from_str("No solution found for the given puzzle.")),
        Err(_) => Err(JsValue::from_str("Solver crashed due to a critical error.")),
    }
}
