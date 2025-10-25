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

use crate::board::Board;

/// The outcome of searching for the next cell to solve.
enum FindResult {
    /// The board is already solved (no empty cells).
    Solved,
    /// The board is in an unsolvable state (an empty cell has 0 valid moves).
    Unsolvable,
    /// The coordinates of the most constrained empty cell to try next.
    Cell(usize, usize),
}

/// Solve the Sudoku puzzle using a backtracking algorithm with an MRV heuristic.
///
/// ### Arguments
///
/// * `board` - A mutable reference to the `Board` to be solved in-place.
///
/// ### Returns
///
/// * `true` if a solution is found, `false` otherwise.
pub fn solve(board: &mut Board) -> bool {
    // Induce a panic for testing the panic boundary in `lib.rs`.
    #[cfg(feature = "test-panic")]
    if board.cells[0] == 1 && board.cells[1] == 2 && board.cells[2] == 3 {
        panic!("Induced panic for testing");
    }

    match find_most_constrained_cell(board) {
        FindResult::Solved => true,
        FindResult::Unsolvable => false,
        FindResult::Cell(row, col) => {
            for num in 1..=9 {
                if board.is_valid_move(row, col, num) {
                    board.cells[row * 9 + col] = num;

                    if solve(board) {
                        return true;
                    }

                    // Backtrack if the path did not lead to a solution.
                    board.cells[row * 9 + col] = 0;
                }
            }
            // Trigger further backtracking if no number works for this cell.
            false
        }
    }
}

/// Solve a Sudoku puzzle using backtracking with a randomized number order.
/// Used for generating a variety of solved boards.
pub fn solve_randomized(board: &mut Board, numbers: &[u8; 9]) -> bool {
    match find_most_constrained_cell(board) {
        FindResult::Solved => true,
        FindResult::Unsolvable => false,
        FindResult::Cell(row, col) => {
            for &num in numbers {
                if board.is_valid_move(row, col, num) {
                    board.cells[row * 9 + col] = num;
                    if solve_randomized(board, numbers) {
                        return true;
                    }
                    board.cells[row * 9 + col] = 0; // Backtrack
                }
            }
            false
        }
    }
}

/// Count the number of solutions for a given board. Stops counting if more than 1 solution is found.
pub fn count_solutions(board: &Board) -> u8 {
    let mut counter = 0;
    let mut board_clone = *board;
    count_solutions_recursive(&mut board_clone, &mut counter);
    counter
}

fn count_solutions_recursive(board: &mut Board, counter: &mut u8) {
    if *counter > 1 {
        return;
    }

    match find_most_constrained_cell(board) {
        FindResult::Solved => {
            *counter += 1;
        }
        FindResult::Unsolvable => (),
        FindResult::Cell(row, col) => {
            for num in 1..=9 {
                if board.is_valid_move(row, col, num) {
                    board.cells[row * 9 + col] = num;
                    count_solutions_recursive(board, counter);
                    if *counter > 1 {
                        return;
                    }
                }
            }
            board.cells[row * 9 + col] = 0; // Backtrack
        }
    }
}


/// Count the number of valid moves (1-9) for a given cell.
fn count_possibilities(board: &Board, row: usize, col: usize) -> u8 {
    let mut possibilities = 0;
    for num in 1..=9 {
        if board.is_valid_move(row, col, num) {
            possibilities += 1;
        }
    }
    possibilities
}

/// Find the empty cell with the fewest valid moves (Minimum Remaining Values heuristic).
fn find_most_constrained_cell(board: &Board) -> FindResult {
    let mut best_cell: Option<(usize, usize)> = None;
    let mut min_possibilities = 10;

    for i in 0..81 {
        if board.cells[i] != 0 {
            continue;
        }

        let row = i / 9;
        let col = i % 9;
        let possibilities = count_possibilities(board, row, col);

        // An empty cell with zero possibilities means the board is unsolvable.
        if possibilities == 0 {
            return FindResult::Unsolvable;
        }

        // Update the best cell if the current one is more constrained.
        if possibilities < min_possibilities {
            min_possibilities = possibilities;
            best_cell = Some((row, col));
            // A cell with only one possibility is the best we can find, so stop.
            if min_possibilities == 1 {
                break;
            }
        }
    }

    match best_cell {
        Some((row, col)) => FindResult::Cell(row, col),
        None => FindResult::Solved,
    }
}
