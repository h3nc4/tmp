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
use crate::types::{Elimination, Placement, SolvingStep};
use std::collections::HashSet;

const ALL_CANDIDATES: u16 = 0b111111111;

/// Helper function to get all peers of a cell (row, col, box, excluding self).
fn get_peer_indices(index: usize) -> Vec<usize> {
    let mut peers = HashSet::new();
    let row = index / 9;
    let col = index % 9;

    // Row peers
    for c in 0..9 {
        peers.insert(row * 9 + c);
    }
    // Column peers
    for r in 0..9 {
        peers.insert(r * 9 + col);
    }
    // Box peers
    let start_row = (row / 3) * 3;
    let start_col = (col / 3) * 3;
    for r_offset in 0..3 {
        for c_offset in 0..3 {
            peers.insert((start_row + r_offset) * 9 + (start_col + c_offset));
        }
    }
    peers.remove(&index);
    peers.into_iter().collect()
}

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

    /// Finds the first available "Naked Single".
    /// A naked single is a cell that has only one possible candidate.
    fn find_naked_single(&self) -> Option<SolvingStep> {
        for i in 0..81 {
            if self.cells[i] == 0 && self.candidates[i].count_ones() == 1 {
                let value = (self.candidates[i].trailing_zeros() + 1) as u8;
                let mut eliminations = vec![];

                // Eliminate this value from all peers that have it as a candidate.
                for &peer_index in &get_peer_indices(i) {
                    if self.cells[peer_index] == 0
                        && (self.candidates[peer_index] & (1 << (value - 1))) != 0
                    {
                        eliminations.push(Elimination {
                            index: peer_index,
                            value,
                        });
                    }
                }

                return Some(SolvingStep {
                    technique: "NakedSingle".to_string(),
                    placements: vec![Placement { index: i, value }],
                    eliminations,
                    cause: vec![],
                });
            }
        }
        None
    }

    /// Checks a single group (row, column, or box) for a hidden single.
    fn find_hidden_single_in_group(
        &self,
        group_indices: impl IntoIterator<Item = usize>,
    ) -> Option<(usize, u8)> {
        let indices: Vec<usize> = group_indices.into_iter().collect();
        for num in 1..=9 {
            let candidate_mask = 1 << (num - 1);
            let mut found_at: Option<usize> = None;
            let mut count = 0;

            for &index in &indices {
                if self.cells[index] == 0 && (self.candidates[index] & candidate_mask) != 0 {
                    count += 1;
                    found_at = Some(index);
                }
            }

            if count == 1 {
                return Some((found_at.unwrap(), num));
            }
        }
        None
    }

    /// Creates a `SolvingStep` for a found hidden single.
    fn create_hidden_single_step(&self, index: usize, value: u8) -> SolvingStep {
        let mut eliminations = vec![];

        // 1. Eliminate other candidates from this cell.
        for cand in 1..=9 {
            if cand != value && (self.candidates[index] & (1 << (cand - 1))) != 0 {
                eliminations.push(Elimination { index, value: cand });
            }
        }

        // 2. Eliminate this value from all peers.
        for &peer_index in &get_peer_indices(index) {
            if self.cells[peer_index] == 0
                && (self.candidates[peer_index] & (1 << (value - 1))) != 0
            {
                eliminations.push(Elimination {
                    index: peer_index,
                    value,
                });
            }
        }

        SolvingStep {
            technique: "HiddenSingle".to_string(),
            placements: vec![Placement { index, value }],
            eliminations,
            cause: vec![],
        }
    }

    /// Finds the first available "Hidden Single".
    fn find_hidden_single(&self) -> Option<SolvingStep> {
        // Check rows
        for r in 0..9 {
            if let Some((index, value)) =
                self.find_hidden_single_in_group((0..9).map(|c| r * 9 + c))
            {
                return Some(self.create_hidden_single_step(index, value));
            }
        }
        // Check columns
        for c in 0..9 {
            if let Some((index, value)) =
                self.find_hidden_single_in_group((0..9).map(|r| r * 9 + c))
            {
                return Some(self.create_hidden_single_step(index, value));
            }
        }
        // Check boxes
        for b in 0..9 {
            let start_row = (b / 3) * 3;
            let start_col = (b % 3) * 3;
            if let Some((index, value)) = self.find_hidden_single_in_group(
                (0..9).map(|i| (start_row + i / 3) * 9 + (start_col + i % 3)),
            ) {
                return Some(self.create_hidden_single_step(index, value));
            }
        }
        None
    }
}

/// Solves the board by repeatedly applying logical techniques and returns the steps.
pub fn solve_with_steps(initial_board: &Board) -> (Vec<SolvingStep>, Board) {
    let mut board = LogicalBoard::from_board(initial_board);
    let mut steps = Vec::new();

    loop {
        if let Some(step) = board.find_naked_single() {
            for placement in &step.placements {
                board.set_cell(placement.index, placement.value);
            }
            steps.push(step);
            continue;
        }
        if let Some(step) = board.find_hidden_single() {
            for placement in &step.placements {
                board.set_cell(placement.index, placement.value);
            }
            steps.push(step);
            continue;
        }

        // If no techniques made a change, the logical solver is done.
        break;
    }

    (steps, Board { cells: board.cells })
}
