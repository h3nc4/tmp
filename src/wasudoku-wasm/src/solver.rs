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

/// Solves the Sudoku puzzle using a backtracking algorithm.
///
/// This function mutates the board in place.
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
    let find_empty = find_empty_cell(board);

    let (row, col) = match find_empty {
        Some((r, c)) => (r, c),
        None => return true, // No empty cells, puzzle is solved
    };

    for num in 1..=9 {
        if board.is_valid_move(row, col, num) {
            board.cells[row * 9 + col] = num;

            if solve(board) {
                return true;
            }

            // Backtrack: if the current path didn't lead to a solution,
            // reset the cell and try the next number.
            board.cells[row * 9 + col] = 0;
        }
    }

    false // No number works for the current cell, trigger backtracking
}

/// Finds the next empty cell (represented by `0`) in the board.
///
/// Traverses the board from left to right, top to bottom.
///
/// ### Returns
///
/// * `Some((row, col))` - The coordinates of the first empty cell found.
/// * `None` - If no empty cells are found on the board.
fn find_empty_cell(board: &Board) -> Option<(usize, usize)> {
    board
        .cells
        .iter()
        .position(|&cell| cell == 0)
        .map(|i| (i / 9, i % 9))
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
        // Two 6s in the first column.
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
