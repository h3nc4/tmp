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

mod board;
mod solver;
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
/// The input string should be 81 characters long, with numbers 1-9 representing
/// filled cells and '.' or '0' representing empty cells.
///
/// ### Arguments
///
/// * `board_str` - A string slice representing the Sudoku board.
///
/// ### Returns
///
/// * `Ok(String)` - A string representing the solved board if a solution is found.
/// * `Err(JsValue)` - An error if the input is invalid, the puzzle is unsolvable, or a crash occurs.
#[wasm_bindgen]
pub fn solve_sudoku(board_str: &str) -> Result<String, JsValue> {
    // Parse the board.
    let mut board = Board::from_str(board_str).map_err(|e| JsValue::from_str(&e))?;

    let solve_result = panic::catch_unwind(move || {
        if solver::solve(&mut board) {
            Some(board) // Return the solved board on success
        } else {
            None // Indicate no solution was found
        }
    });

    match solve_result {
        // Solved successfully: Ok(Some(board))
        Ok(Some(solved_board)) => Ok(solved_board.to_string()),
        // No solution found: Ok(None)
        Ok(None) => Err(JsValue::from_str("No solution found for the given puzzle.")),
        // A panic was caught: Err(_)
        Err(_) => Err(JsValue::from_str("Solver crashed due to a critical error.")),
    }
}
