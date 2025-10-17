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

/// Represents the outcome of searching for the next cell to solve.
enum FindResult {
    /// The board is already solved (no empty cells).
    Solved,
    /// The board is in an unsolvable state (an empty cell has 0 valid moves).
    Unsolvable,
    /// The coordinates of the most constrained cell to try next.
    Cell(usize, usize),
}

/// Solves the Sudoku puzzle using a backtracking algorithm.
///
/// ### Arguments
///
/// * `board` - A mutable reference to the `Board` to be solved.
///
/// ### Returns
///
/// * `true` if a solution is found.
/// * `false` if the puzzle is unsolvable.
pub fn solve(board: &mut Board) -> bool {
    // A test-only feature to ensure the panic boundary in `lib.rs` is covered.
    #[cfg(feature = "test-panic")]
    if board.cells[0] == 1 && board.cells[1] == 2 && board.cells[2] == 3 {
        panic!("Induced panic for testing");
    }

    // Find the state of the board or the next best cell to operate on.
    match find_most_constrained_cell(board) {
        // The board is fully solved.
        FindResult::Solved => true,
        // The board has reached a dead end, backtrack immediately.
        FindResult::Unsolvable => false,
        // Proceed with the most constrained cell.
        FindResult::Cell(row, col) => {
            // Iterate through only the valid numbers for this specific cell.
            for num in 1..=9 {
                if board.is_valid_move(row, col, num) {
                    board.cells[row * 9 + col] = num;

                    if solve(board) {
                        return true;
                    }

                    // Backtrack: if this path didn't work, reset the cell.
                    board.cells[row * 9 + col] = 0;
                }
            }
            // If no valid number for this cell leads to a solution, trigger backtracking.
            false
        }
    }
}

/// Counts the number of valid moves (1-9) for a given cell.
fn count_possibilities(board: &Board, row: usize, col: usize) -> u8 {
    let mut possibilities = 0;
    for num in 1..=9 {
        if board.is_valid_move(row, col, num) {
            possibilities += 1;
        }
    }
    possibilities
}

/// MRV heuristic: Finds the empty cell with the fewest valid candidates.
fn find_most_constrained_cell(board: &Board) -> FindResult {
    let mut best_cell: Option<(usize, usize)> = None;
    let mut min_possibilities = 10; // Start with a value > 9

    for i in 0..81 {
        if board.cells[i] != 0 {
            continue;
        }

        let row = i / 9;
        let col = i % 9;
        let possibilities = count_possibilities(board, row, col);

        // Stop immediately if an empty cell with 0 possibilities is found.
        if possibilities == 0 {
            return FindResult::Unsolvable;
        }

        // Update the best cell if the current has fewer possibilities.
        if possibilities < min_possibilities {
            min_possibilities = possibilities;
            best_cell = Some((row, col));
            // Stop searching if a cell with only 1 possibility is found (optimization).
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
