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
/// * `Err(JsValue)` - An error if the input is invalid or the puzzle is unsolvable.
#[wasm_bindgen]
pub fn solve_sudoku(board_str: &str) -> Result<String, JsValue> {
    let mut board = Board::from_str(board_str).map_err(|e| JsValue::from_str(&e))?;

    if solver::solve(&mut board) {
        Ok(board.to_string())
    } else {
        Err(JsValue::from_str("No solution found for the given puzzle."))
    }
}
