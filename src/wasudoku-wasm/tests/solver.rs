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
use wasudoku_wasm::solver::{count_solutions, solve, solve_randomized};

#[test]
fn test_solve_easy_puzzle() {
    let puzzle_str =
        "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";
    let solution_str =
        "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

    let mut board: Board = puzzle_str.parse().unwrap();
    let solved = solve(&mut board);

    assert!(solved);
    assert_eq!(board.to_string(), solution_str);
}

#[test]
fn test_solve_hard_puzzle() {
    let puzzle_str =
        "8..........36......7..9.2...5...7.......457.....1...3...1....68..85...1..9....4..";
    let solution_str =
        "812753649943682175675491283154237896369845721287169534521974368438526917796318452";

    let mut board: Board = puzzle_str.parse().unwrap();
    let solved = solve(&mut board);

    assert!(solved);
    assert_eq!(board.to_string(), solution_str);
}

#[test]
fn test_already_solved_puzzle() {
    let solution_str =
        "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
    let mut board: Board = solution_str.parse().unwrap();
    let solved = solve(&mut board);

    assert!(solved);
    assert_eq!(board.to_string(), solution_str);
}

#[test]
fn test_unsolvable_puzzle_returns_false() {
    // An unsolvable puzzle `23456789` in a row and a `1` in the box where it should be.
    let puzzle_str =
        "...................................123456789.....................................";
    let mut board: Board = puzzle_str.parse().unwrap();

    // The solver should correctly determine this is unsolvable and return false.
    let solved = solve(&mut board);
    assert!(!solved);
}

#[test]
fn test_board_from_str_valid() {
    let puzzle_str =
        "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";
    assert!(puzzle_str.parse::<Board>().is_ok());
}

#[test]
fn test_board_from_str_invalid_length() {
    let puzzle_str = "123";
    assert!(puzzle_str.parse::<Board>().is_err());
}

#[test]
fn test_board_from_str_invalid_char() {
    let puzzle_str =
        "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..7a";
    assert!(puzzle_str.parse::<Board>().is_err());
}

#[test]
fn test_board_from_str_conflict_in_row() {
    // Two 5s in the first row.
    let puzzle_str =
        "53..7.5..6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";
    assert!(puzzle_str.parse::<Board>().is_err());
}

#[test]
fn test_board_from_str_conflict_in_col() {
    // Two 5s in the first column.
    let puzzle_str =
        "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";
    let mut chars: Vec<char> = puzzle_str.chars().collect();
    chars[9] = '5'; // Second row, first column -> conflict with first row, first column
    let conflict_str: String = chars.into_iter().collect();
    assert!(conflict_str.parse::<Board>().is_err());
}

#[test]
fn test_board_from_str_conflict_in_box() {
    // Two 1s in the first 3x3 box.
    let puzzle_str =
        "53..7....61.195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";
    assert!(puzzle_str.parse::<Board>().is_err());
}

#[test]
fn test_solve_randomized_solves_empty_board() {
    let mut board = Board { cells: [0; 81] };
    let numbers: [u8; 9] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    let solved = solve_randomized(&mut board, &numbers);
    assert!(solved);
    assert!(!board.cells.contains(&0));
}

#[test]
fn test_count_solutions() {
    // Puzzle with a unique solution
    let puzzle_str =
        "8..........36......7..9.2...5...7.......457.....1...3...1....68..85...1..9....4..";
    let board: Board = puzzle_str.parse().unwrap();
    assert_eq!(count_solutions(&board), 1);

    // Puzzle with multiple solutions
    let multi_solution_str =
        ".................................................................................";
    let board: Board = multi_solution_str.parse().unwrap();
    assert!(
        count_solutions(&board) > 1,
        "Expected more than one solution for an empty board"
    );

    // Puzzle with no solution
    let no_solution_str =
        "...................................123456789.....................................";
    let board: Board = no_solution_str.parse().unwrap();
    assert_eq!(count_solutions(&board), 0);
}

#[test]
#[should_panic(expected = "Induced panic for testing")]
#[cfg(feature = "test-panic")]
fn test_induced_panic_is_triggered() {
    let puzzle_str =
        "123..............................................................................";
    let mut board: Board = puzzle_str.parse().unwrap();
    solve(&mut board);
}
