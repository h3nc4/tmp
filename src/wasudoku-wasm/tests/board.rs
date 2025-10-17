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

use wasudoku_wasm::board::Board;

/// Provides a fully solved board for testing.
fn solved_board() -> Board {
    let puzzle_str =
        "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
    Board::from_str(puzzle_str).unwrap()
}

#[test]
fn test_is_valid_move_true_for_empty_spot() {
    let mut board = solved_board();
    board.cells[0] = 0; // Make top-left empty
    assert!(board.is_valid_move(0, 0, 5));
}

#[test]
fn test_is_valid_move_false_for_row_conflict() {
    let board = solved_board();
    // Try to place a '3' at (0, 2), which is invalid due to '3' at (0, 1)
    assert!(!board.is_valid_move(0, 2, 3));
}

#[test]
fn test_is_valid_move_false_for_col_conflict() {
    let board = solved_board();
    // Try to place a '5' at (1, 0), invalid due to '5' at (0,0)
    assert!(!board.is_valid_move(1, 0, 5));
}

#[test]
fn test_is_valid_move_false_for_box_conflict() {
    let board = solved_board();
    // Try to place a '7' at (0, 2), which is invalid due to '7' at (1, 1) in the same box
    assert!(!board.is_valid_move(0, 2, 7));
}

#[test]
fn test_display_board() {
    let puzzle_str =
        "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";
    let board = Board::from_str(puzzle_str).unwrap();
    assert_eq!(board.to_string(), puzzle_str);
}
