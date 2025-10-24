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

/// A 9x9 Sudoku board.
///
/// Stores the board as a flat array of 81 `u8` cells, where `0` represents
/// an empty cell and `1` through `9` represent filled cells.
#[derive(Clone, Copy, PartialEq, Eq)]
pub struct Board {
    pub cells: [u8; 81],
}

impl Board {
    /// Parse and validate an 81-character string into a `Board`.
    ///
    /// The string is parsed row by row, with `.` or `0` representing empty
    /// cells. The board is validated in a single pass to ensure no initial
    /// rule conflicts exist.
    ///
    /// ### Errors
    ///
    /// Returns an `Err` if the string is not 81 characters, contains invalid
    /// characters, or describes a board with initial conflicts.
    pub fn from_str(s: &str) -> Result<Self, String> {
        if s.len() != 81 {
            return Err(format!(
                "Invalid board string length: expected 81, got {}",
                s.len()
            ));
        }

        let mut cells = [0; 81];
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

                if (rows[row] & mask) != 0
                    || (cols[col] & mask) != 0
                    || (boxes[box_index] & mask) != 0
                {
                    return Err(String::from(
                        "Invalid puzzle: initial configuration has conflicts.",
                    ));
                }
                rows[row] |= mask;
                cols[col] |= mask;
                boxes[box_index] |= mask;
            }
        }

        Ok(Board { cells })
    }

    /// Check if placing a number in a cell is valid according to Sudoku rules.
    ///
    /// A move is valid if the number does not already exist in the cell's
    /// row, column, or 3x3 box.
    pub fn is_valid_move(&self, row: usize, col: usize, num: u8) -> bool {
        for x in 0..9 {
            if self.cells[row * 9 + x] == num {
                return false;
            }
        }

        for x in 0..9 {
            if self.cells[x * 9 + col] == num {
                return false;
            }
        }

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

/// Format the board as an 81-character string, using `.` for empty cells.
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
