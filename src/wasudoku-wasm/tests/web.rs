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

#![cfg(target_arch = "wasm32")]

use wasm_bindgen_test::*;
use wasudoku_wasm::solve_sudoku;

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test]
fn test_solve_sudoku_valid_puzzle() {
    let puzzle_str =
        "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";
    let solution_str =
        "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
    let result = solve_sudoku(puzzle_str).unwrap();
    let solve_result: wasudoku_wasm::types::SolveResult =
        serde_wasm_bindgen::from_value(result).unwrap();

    assert!(solve_result.solution.is_some(), "Expected a solution");
    assert_eq!(solve_result.solution.unwrap(), solution_str);
    assert!(!solve_result.steps.is_empty(), "Expected logical steps");
}

#[wasm_bindgen_test]
fn test_solve_sudoku_no_solution() {
    // An unsolvable puzzle with conflicting givens that the solver can't satisfy.
    let puzzle_str =
        "1.2.3.4.5.6.7.8.9..............................................................";
    let result = solve_sudoku(puzzle_str);
    assert!(
        result.is_err(),
        "Expected an error for an unsolvable puzzle"
    );
    assert_eq!(
        result.err().unwrap().as_string().unwrap(),
        "No solution found for the given puzzle."
    );
}

#[wasm_bindgen_test]
fn test_solve_sudoku_invalid_board_string_length() {
    let puzzle_str = "123";
    let result = solve_sudoku(puzzle_str);
    assert!(
        result.is_err(),
        "Expected an error for invalid string length"
    );
    assert_eq!(
        result.err().unwrap().as_string().unwrap(),
        "Invalid board string length: expected 81, got 3"
    );
}

#[wasm_bindgen_test]
fn test_solve_sudoku_invalid_board_string_char() {
    let puzzle_str =
        "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..7a";
    let result = solve_sudoku(puzzle_str);
    assert!(result.is_err(), "Expected an error for invalid character");
    assert_eq!(
        result.err().unwrap().as_string().unwrap(),
        "Invalid character 'a' in board string at index 80"
    );
}

#[wasm_bindgen_test]
fn test_solve_sudoku_initial_conflict() {
    // Two '5's in the first row
    let puzzle_str =
        "53..7.5..6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";
    let result = solve_sudoku(puzzle_str);
    assert!(result.is_err(), "Expected an error for initial conflict");
    assert_eq!(
        result.err().unwrap().as_string().unwrap(),
        "Invalid puzzle: initial configuration has conflicts."
    );
}

// This test is only compiled when the `test-panic` feature is enabled.
#[cfg(feature = "test-panic")]
#[wasm_bindgen_test]
fn test_solve_sudoku_panic_handling() {
    let puzzle_str =
        "123..............................................................................";
    let result = solve_sudoku(puzzle_str);
    assert!(result.is_err(), "Expected an error from a panic");
    assert_eq!(
        result.err().unwrap().as_string().unwrap(),
        "Solver crashed due to a critical error."
    );
}
