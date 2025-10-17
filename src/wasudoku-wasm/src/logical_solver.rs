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

//! A logical Sudoku solver that uses human-like techniques.

use crate::board::Board;

const ALL_CANDIDATES: u16 = 0b111111111;

/// Represents a Sudoku board with candidate tracking for logical solving.
#[derive(Clone, Copy, PartialEq, Eq)]
pub struct LogicalBoard {
    /// The definitive numbers on the board (0 for empty).
    pub cells: [u8; 81],
    /// A bitmask for each cell representing possible candidates (1-9).
    /// A 0 indicates the cell is filled.
    pub candidates: [u16; 81],
}

impl LogicalBoard {
    /// Creates a `LogicalBoard` from a simple `Board`, calculating initial candidates.
    pub fn from_board(board: &Board) -> Self {
        let mut logical_board = LogicalBoard {
            cells: board.cells,
            candidates: [0; 81],
        };

        // Initialize candidates for empty cells.
        for i in 0..81 {
            if logical_board.cells[i] == 0 {
                logical_board.candidates[i] = ALL_CANDIDATES;
            }
        }

        // Propagate constraints from existing numbers.
        for i in 0..81 {
            if logical_board.cells[i] != 0 {
                logical_board.eliminate_candidates(i, logical_board.cells[i]);
            }
        }

        logical_board
    }

    /// Places a number on the board and updates the candidates of its peers.
    fn set_cell(&mut self, index: usize, value: u8) {
        self.cells[index] = value;
        self.candidates[index] = 0;
        self.eliminate_candidates(index, value);
    }

    /// Eliminates a candidate from all peer cells of a given index.
    fn eliminate_candidates(&mut self, index: usize, value: u8) {
        let row = index / 9;
        let col = index % 9;
        let elimination_mask = !(1 << (value - 1));

        // Eliminate from row
        for c in 0..9 {
            self.candidates[row * 9 + c] &= elimination_mask;
        }

        // Eliminate from column
        for r in 0..9 {
            self.candidates[r * 9 + col] &= elimination_mask;
        }

        // Eliminate from box
        let start_row = (row / 3) * 3;
        let start_col = (col / 3) * 3;
        for r_offset in 0..3 {
            for c_offset in 0..3 {
                self.candidates[(start_row + r_offset) * 9 + (start_col + c_offset)] &=
                    elimination_mask;
            }
        }
    }

    /// Finds and applies the first available "Naked Single".
    /// A naked single is a cell that has only one possible candidate.
    /// Returns true if a single was found and applied, false otherwise.
    pub fn apply_naked_singles(&mut self) -> bool {
        for i in 0..81 {
            if self.cells[i] == 0 && self.candidates[i].count_ones() == 1 {
                let value = (self.candidates[i].trailing_zeros() + 1) as u8;
                self.set_cell(i, value);
                return true; // Return immediately after making a change
            }
        }
        false
    }

    /// Finds and applies the first available "Hidden Single".
    /// A hidden single is a candidate that appears only once in a given row, column, or box.
    /// Returns true if a single was found and applied, false otherwise.
    fn apply_hidden_singles(&mut self) -> bool {
        // Check rows, columns, and boxes
        for group_type in 0..3 {
            for i in 0..9 {
                for num in 1..=9 {
                    let candidate_mask = 1 << (num - 1);
                    let mut found_at: Option<usize> = None;
                    let mut count = 0;

                    for j in 0..9 {
                        let index = match group_type {
                            0 => i * 9 + j, // Row
                            1 => j * 9 + i, // Column
                            _ => {
                                // Box
                                let start_row = (i / 3) * 3;
                                let start_col = (i % 3) * 3;
                                (start_row + j / 3) * 9 + (start_col + j % 3)
                            }
                        };

                        if self.cells[index] == 0 && (self.candidates[index] & candidate_mask) != 0
                        {
                            count += 1;
                            found_at = Some(index);
                        }
                    }

                    if count == 1 {
                        let index = found_at.unwrap();
                        // The redundant `if self.cells[index] == 0` check is removed,
                        // as the logic above already guarantees the cell is empty.
                        self.set_cell(index, num);
                        return true; // Return immediately after making a change
                    }
                }
            }
        }
        false
    }
}

/// Solves the board by repeatedly applying logical techniques until no more progress can be made.
/// The loop structure is designed to be extensible with more complex techniques.
pub fn solve(board: &mut LogicalBoard) {
    loop {
        // Apply the easiest techniques first. If one makes a change, restart the loop
        // to ensure we always proceed from a consistent state.
        if board.apply_naked_singles() {
            continue;
        }
        if board.apply_hidden_singles() {
            continue;
        }

        // Future techniques would be added here, e.g.:
        // if board.apply_naked_pairs() { continue; }
        // if board.apply_pointing_pairs() { continue; }

        // If we complete a full pass of all techniques without making any changes,
        // the logical solver is stuck and we break the loop.
        break;
    }
}
