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

/// MRV heuristic: Finds the empty cell with the fewest valid candidates.
fn find_most_constrained_cell(board: &Board) -> FindResult {
    let mut best_cell: Option<(usize, usize)> = None;
    let mut min_possibilities = 10; // Start with a value > 9
    let mut found_empty_cell = false;
    for i in 0..81 {
        if board.cells[i] == 0 {
            found_empty_cell = true;
            let row = i / 9;
            let col = i % 9;
            let mut possibilities = 0;

            for num in 1..=9 {
                if board.is_valid_move(row, col, num) {
                    possibilities += 1;
                }
            }

            // Stop immediately if an empty cell with 0 possibilities is found.
            if possibilities == 0 {
                return FindResult::Unsolvable;
            }

            // Update the best cell if the current has fewer possibilities.
            if possibilities < min_possibilities {
                min_possibilities = possibilities;
                best_cell = Some((row, col));
                // Stop searching if a cell with only 1 possibility is found.
                if min_possibilities == 1 {
                    break;
                }
            }
        }
    }
    if !found_empty_cell {
        FindResult::Solved
    } else {
        // Return the most constrained cell found.
        let (row, col) = best_cell.unwrap();
        FindResult::Cell(row, col)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::board::Board;

    #[test]
    fn test_solve_easy_puzzle() {
        let puzzle_str =
            "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";
        let solution_str =
            "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

        let mut board = Board::from_str(puzzle_str).unwrap();
        let solved = solve(&mut board);

        assert!(solved);
        assert_eq!(board.to_string(), solution_str);
    }

    #[test]
    fn test_solve_hard_puzzle() {
        // A difficult puzzle.
        let puzzle_str =
            "8..........36......7..9.2...5...7.......457.....1...3...1....68..85...1..9....4..";
        let solution_str =
            "812753649943682175675491283154237896369845721287169534521974368438526917796318452";

        let mut board = Board::from_str(puzzle_str).unwrap();
        let solved = solve(&mut board);

        assert!(
            solved,
            "The solver should find a solution for the hard puzzle."
        );
        assert_eq!(board.to_string(), solution_str);
    }

    #[test]
    fn test_already_solved_puzzle() {
        let solution_str =
            "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
        let mut board = Board::from_str(solution_str).unwrap();
        let solved = solve(&mut board);

        assert!(solved);
        assert_eq!(board.to_string(), solution_str);
    }

    #[test]
    fn test_unsolvable_puzzle_returns_false() {
        // An unsolvable puzzle `23456789` in a row and a `1` in the box where it should be.
        let puzzle_str =
            "...................................123456789.....................................";
        let mut board = Board::from_str(puzzle_str).unwrap();

        // The solver should correctly determine this is unsolvable and return false.
        let solved = solve(&mut board);
        assert!(
            !solved,
            "Solver should have returned false for an unsolvable puzzle."
        );
    }

    #[test]
    fn test_board_from_str_valid() {
        let puzzle_str =
            "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";
        assert!(Board::from_str(puzzle_str).is_ok());
    }

    #[test]
    fn test_board_from_str_invalid_length() {
        let puzzle_str = "123";
        assert!(Board::from_str(puzzle_str).is_err());
    }

    #[test]
    fn test_board_from_str_invalid_char() {
        let puzzle_str =
            "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..7a";
        assert!(Board::from_str(puzzle_str).is_err());
    }

    #[test]
    fn test_board_from_str_conflict_in_row() {
        // Two 5s in the first row.
        let puzzle_str =
            "53..7.5..6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";
        assert!(Board::from_str(puzzle_str).is_err());
    }

    #[test]
    fn test_board_from_str_conflict_in_col() {
        // Two 5s in the first column.
        let puzzle_str =
            "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";
        let mut chars: Vec<char> = puzzle_str.chars().collect();
        chars[9] = '5'; // Second row, first column -> conflict with first row, first column
        let conflict_str: String = chars.into_iter().collect();
        assert!(Board::from_str(&conflict_str).is_err());
    }

    #[test]
    fn test_board_from_str_conflict_in_box() {
        // Two 1s in the first 3x3 box.
        let puzzle_str =
            "53..7....61.195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";
        assert!(Board::from_str(puzzle_str).is_err());
    }
}
