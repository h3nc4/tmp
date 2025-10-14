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

use std::fmt;

/// Represents a 9x9 Sudoku board.
///
/// The board is stored as a flat array of 81 `u8` cells, arranged row by row.
/// A value of `0` represents an empty cell, while `1` through `9` represent filled cells.
#[derive(Clone, Copy, PartialEq, Eq)]
pub struct Board {
    pub cells: [u8; 81],
}

impl Board {
    /// Parses an 81-character string into a `Board` and validates it.
    ///
    /// The string is parsed row by row. Characters `.` or `0` are treated as
    /// empty cells. The board's initial state is validated in a single pass
    /// to ensure there are no rule conflicts.
    ///
    /// ### Errors
    ///
    /// Returns an `Err` if the string is not 81 characters long, contains invalid
    /// characters, or describes a board with initial conflicts.
    pub fn from_str(s: &str) -> Result<Self, String> {
        if s.len() != 81 {
            return Err(format!(
                "Invalid board string length: expected 81, got {}",
                s.len()
            ));
        }

        let mut cells = [0; 81];
        // Use bitmasks for validity checks. 9 bits, one for each number (1-9).
        let mut rows = [0u16; 9];
        let mut cols = [0u16; 9];
        let mut boxes = [0u16; 9];

        for (i, char) in s.chars().enumerate() {
            let digit = match char {
                '.' | '0' => 0,
                '1'..='9' => char.to_digit(10).unwrap() as u8,
                _ => {
                    return Err(format!(
                        "Invalid character '{}' in board string at index {}",
                        char, i
                    ));
                }
            };
            cells[i] = digit;

            if digit != 0 {
                let row = i / 9;
                let col = i % 9;
                let box_index = (row / 3) * 3 + (col / 3);
                let mask = 1 << (digit - 1);

                // Check if the number has already been seen in this row, col, or box.
                if (rows[row] & mask) != 0
                    || (cols[col] & mask) != 0
                    || (boxes[box_index] & mask) != 0
                {
                    return Err(String::from(
                        "Invalid puzzle: initial configuration has conflicts.",
                    ));
                }
                // Mark the number as seen for the corresponding row, column, and box.
                rows[row] |= mask;
                cols[col] |= mask;
                boxes[box_index] |= mask;
            }
        }

        Ok(Board { cells })
    }

    /// Checks if placing a number in a given cell is valid according to Sudoku rules.
    ///
    /// A move is valid if the number does not already exist in the same row, column,
    /// or 3x3 subgrid. This function is a critical hot path for the solver.
    pub fn is_valid_move(&self, row: usize, col: usize, num: u8) -> bool {
        // Check row
        for x in 0..9 {
            if self.cells[row * 9 + x] == num {
                return false;
            }
        }

        // Check column
        for x in 0..9 {
            if self.cells[x * 9 + col] == num {
                return false;
            }
        }

        // Check 3x3 subgrid
        let start_row = row - row % 3;
        let start_col = col - col % 3;
        for i in 0..3 {
            for j in 0..3 {
                if self.cells[(start_row + i) * 9 + (start_col + j)] == num {
                    return false;
                }
            }
        }

        true
    }
}

/// Implements string formatting for the `Board`.
/// The board is converted to an 81-character string, with `.` for empty cells.
impl fmt::Display for Board {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let mut s = String::with_capacity(81);
        for &cell in self.cells.iter() {
            if cell == 0 {
                s.push('.');
            } else {
                s.push(std::char::from_digit(cell as u32, 10).unwrap());
            }
        }
        write!(f, "{}", s)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
}
