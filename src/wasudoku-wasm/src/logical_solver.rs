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
use crate::types::{CauseCell, Elimination, Placement, SolvingStep};
use std::collections::HashSet;

/// Bitmask representing all candidates (1-9) for a cell.
const ALL_CANDIDATES: u16 = 0b111111111;

// Pre-calculate and cache indices for all rows, columns, boxes, and peer cells.
// This avoids repeated calculations in hot loops within the solver.
lazy_static::lazy_static! {
    static ref ROW_UNITS: [[usize; 9]; 9] = {
        let mut units = [[0; 9]; 9];
        for i in 0..9 {
            for j in 0..9 {
                units[i][j] = i * 9 + j;
            }
        }
        units
    };
    static ref COL_UNITS: [[usize; 9]; 9] = {
        let mut units = [[0; 9]; 9];
        for i in 0..9 {
            for j in 0..9 {
                units[i][j] = j * 9 + i;
            }
        }
        units
    };
    static ref BOX_UNITS: [[usize; 9]; 9] = {
        let mut units = [[0; 9]; 9];
        for i in 0..9 {
            let start_row = (i / 3) * 3;
            let start_col = (i % 3) * 3;
            for j in 0..9 {
                units[i][j] = (start_row + j / 3) * 9 + (start_col + j % 3);
            }
        }
        units
    };
    /// A collection of all 27 units (9 rows, 9 columns, 9 boxes).
    static ref ALL_UNITS: Vec<&'static [usize]> = {
        let mut units = Vec::with_capacity(27);
        units.extend(ROW_UNITS.iter().map(|u| &u[..]));
        units.extend(COL_UNITS.iter().map(|u| &u[..]));
        units.extend(BOX_UNITS.iter().map(|u| &u[..]));
        units
    };
    /// A map from a cell index to a vector of its 20 peers.
    static ref PEER_MAP: [Vec<usize>; 81] = {
        let mut map = [(); 81].map(|_| Vec::with_capacity(20));
        for i in 0..81 {
            let mut peers = HashSet::new();
            let row = i / 9;
            let col = i % 9;

            for c in 0..9 { peers.insert(row * 9 + c); }
            for r in 0..9 { peers.insert(r * 9 + col); }
            let start_row = (row / 3) * 3;
            let start_col = (col / 3) * 3;
            for r_offset in 0..3 {
                for c_offset in 0..3 {
                    peers.insert((start_row + r_offset) * 9 + (start_col + c_offset));
                }
            }
            peers.remove(&i);
            map[i] = peers.into_iter().collect();
        }
        map
    };
}

/// Represents the logical difficulty of a solving technique.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum TechniqueLevel {
    None,         // No logical moves found
    Basic,        // Naked/Hidden Singles
    Intermediate, // Pointing Subsets, Naked/Hidden Pairs/Triples
}

/// Convert a bitmask of candidates into a `Vec` of numbers.
fn mask_to_vec(mask: u16) -> Vec<u8> {
    (1..=9)
        .filter(|&num| (mask >> (num - 1)) & 1 == 1)
        .collect()
}

/// A Sudoku board with candidate tracking for logical solving.
#[derive(Clone, Copy, PartialEq, Eq)]
pub struct LogicalBoard {
    /// The definitive numbers on the board (0 for empty).
    pub cells: [u8; 81],
    /// A bitmask for each cell representing possible candidates (1-9).
    /// A `0` indicates the cell is filled.
    pub candidates: [u16; 81],
}

impl LogicalBoard {
    /// Create a `LogicalBoard` from a simple `Board` by calculating initial candidates.
    pub fn from_board(board: &Board) -> Self {
        let mut logical_board = LogicalBoard {
            cells: board.cells,
            candidates: [0; 81],
        };

        // Initialize candidates for all empty cells.
        for i in 0..81 {
            if logical_board.cells[i] == 0 {
                logical_board.candidates[i] = ALL_CANDIDATES;
            }
        }

        // Propagate constraints from existing numbers to establish the initial candidate state.
        for i in 0..81 {
            if logical_board.cells[i] != 0 {
                logical_board.eliminate_from_peers(i, logical_board.cells[i]);
            }
        }
        logical_board
    }

    /// Place a number on the board and update the candidates of its peers.
    fn set_cell(&mut self, index: usize, value: u8) -> bool {
        if self.cells[index] != 0 {
            return false;
        }
        self.cells[index] = value;
        self.candidates[index] = 0;
        self.eliminate_from_peers(index, value);
        true
    }

    /// Eliminate a candidate from all peer cells of a given index.
    fn eliminate_from_peers(&mut self, index: usize, value: u8) {
        let elimination_mask = !(1 << (value - 1));
        for &peer_index in &PEER_MAP[index] {
            self.candidates[peer_index] &= elimination_mask;
        }
    }

    /// Find the first available "Naked Single" on the board.
    /// A Naked Single is a cell that has only one possible candidate.
    fn find_naked_single(&self) -> Option<SolvingStep> {
        for i in 0..81 {
            if self.cells[i] == 0 && self.candidates[i].count_ones() == 1 {
                let value = (self.candidates[i].trailing_zeros() + 1) as u8;
                let eliminations = PEER_MAP[i]
                    .iter()
                    .filter(|&&peer_idx| {
                        self.cells[peer_idx] == 0
                            && (self.candidates[peer_idx] & (1 << (value - 1))) != 0
                    })
                    .map(|&peer_idx| Elimination {
                        index: peer_idx,
                        value,
                    })
                    .collect();

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

    /// Find a "Hidden Single" in a given group of cells (row, column, or box).
    /// A Hidden Single is a candidate that appears only once within a unit.
    fn find_hidden_single_in_group(&self, group: &[usize]) -> Option<SolvingStep> {
        for num in 1..=9 {
            let mask = 1 << (num - 1);
            let mut potential_indices = Vec::new();
            for &index in group {
                if self.cells[index] == 0 && (self.candidates[index] & mask) != 0 {
                    potential_indices.push(index);
                }
            }
            if potential_indices.len() == 1 {
                let index = potential_indices[0];
                let value = num;
                let mut eliminations = PEER_MAP[index]
                    .iter()
                    .filter(|&&p_idx| {
                        self.cells[p_idx] == 0 && (self.candidates[p_idx] & mask) != 0
                    })
                    .map(|&p_idx| Elimination {
                        index: p_idx,
                        value,
                    })
                    .collect::<Vec<_>>();

                // Also eliminate other candidates from the cell itself.
                for cand in 1..=9 {
                    if cand != value && (self.candidates[index] & (1 << (cand - 1))) != 0 {
                        eliminations.push(Elimination { index, value: cand });
                    }
                }

                return Some(SolvingStep {
                    technique: "HiddenSingle".to_string(),
                    placements: vec![Placement { index, value }],
                    eliminations,
                    cause: vec![],
                });
            }
        }
        None
    }

    /// Find Naked Subsets (Pairs, Triples) in any unit.
    /// A Naked Pair is two cells in the same unit that have the exact same two candidates.
    fn find_naked_subset(&self, size: usize) -> Option<SolvingStep> {
        let tech_name = format!(
            "Naked{}",
            match size {
                2 => "Pair",
                3 => "Triple",
                _ => "Subset",
            }
        );
        for unit in ALL_UNITS.iter() {
            let empty_cells: Vec<usize> = unit
                .iter()
                .filter(|&&i| {
                    self.cells[i] == 0 && self.candidates[i].count_ones() as usize <= size
                })
                .cloned()
                .collect();

            if empty_cells.len() <= size {
                continue;
            }

            // A simplified combination generator for pairs.
            for i in 0..empty_cells.len() {
                for j in (i + 1)..empty_cells.len() {
                    if size == 2 {
                        let c1_idx = empty_cells[i];
                        let c2_idx = empty_cells[j];
                        if self.candidates[c1_idx] == self.candidates[c2_idx]
                            && self.candidates[c1_idx].count_ones() == 2
                        {
                            let combined_mask = self.candidates[c1_idx];
                            let mut eliminations = Vec::new();
                            let cause_cells = vec![c1_idx, c2_idx];
                            for &cell_idx in unit.iter() {
                                if !cause_cells.contains(&cell_idx) && self.cells[cell_idx] == 0 {
                                    if (self.candidates[cell_idx] & combined_mask) != 0 {
                                        for cand in mask_to_vec(combined_mask) {
                                            if (self.candidates[cell_idx] & (1 << (cand - 1))) != 0
                                            {
                                                eliminations.push(Elimination {
                                                    index: cell_idx,
                                                    value: cand,
                                                });
                                            }
                                        }
                                    }
                                }
                            }
                            if !eliminations.is_empty() {
                                let cause_cands = mask_to_vec(combined_mask);
                                return Some(SolvingStep {
                                    technique: tech_name,
                                    placements: vec![],
                                    eliminations,
                                    cause: cause_cells
                                        .iter()
                                        .map(|&idx| CauseCell {
                                            index: idx,
                                            candidates: cause_cands.clone(),
                                        })
                                        .collect(),
                                });
                            }
                        }
                    }
                }
            }
        }
        None
    }

    /// Find Pointing Pairs/Triples.
    /// This occurs when a candidate within a box is confined to a single row or column.
    fn find_pointing_subset(&self) -> Option<SolvingStep> {
        for box_unit in BOX_UNITS.iter() {
            for num in 1..=9 {
                let mask = 1 << (num - 1);
                let cells_with_cand: Vec<usize> = box_unit
                    .iter()
                    .filter(|&&i| self.cells[i] == 0 && (self.candidates[i] & mask) != 0)
                    .cloned()
                    .collect();

                if cells_with_cand.len() < 2 || cells_with_cand.len() > 3 {
                    continue;
                }

                let first_row = cells_with_cand[0] / 9;
                let first_col = cells_with_cand[0] % 9;

                let all_in_same_row = cells_with_cand.iter().all(|&i| i / 9 == first_row);
                let all_in_same_col = cells_with_cand.iter().all(|&i| i % 9 == first_col);

                if all_in_same_row {
                    let mut elims = Vec::new();
                    for col in 0..9 {
                        let idx = first_row * 9 + col;
                        if !box_unit.contains(&idx)
                            && self.cells[idx] == 0
                            && (self.candidates[idx] & mask) != 0
                        {
                            elims.push(Elimination {
                                index: idx,
                                value: num,
                            });
                        }
                    }
                    if !elims.is_empty() {
                        return Some(SolvingStep {
                            technique: if cells_with_cand.len() == 2 {
                                "PointingPair".to_string()
                            } else {
                                "PointingTriple".to_string()
                            },
                            placements: vec![],
                            eliminations: elims,
                            cause: cells_with_cand
                                .iter()
                                .map(|&idx| CauseCell {
                                    index: idx,
                                    candidates: vec![num],
                                })
                                .collect(),
                        });
                    }
                }

                if all_in_same_col {
                    let mut elims = Vec::new();
                    for row in 0..9 {
                        let idx = row * 9 + first_col;
                        if !box_unit.contains(&idx)
                            && self.cells[idx] == 0
                            && (self.candidates[idx] & mask) != 0
                        {
                            elims.push(Elimination {
                                index: idx,
                                value: num,
                            });
                        }
                    }
                    if !elims.is_empty() {
                        return Some(SolvingStep {
                            technique: if cells_with_cand.len() == 2 {
                                "PointingPair".to_string()
                            } else {
                                "PointingTriple".to_string()
                            },
                            placements: vec![],
                            eliminations: elims,
                            cause: cells_with_cand
                                .iter()
                                .map(|&idx| CauseCell {
                                    index: idx,
                                    candidates: vec![num],
                                })
                                .collect(),
                        });
                    }
                }
            }
        }
        None
    }
}

/// Solve the board by repeatedly applying logical techniques and return the steps.
pub fn solve_with_steps(initial_board: &Board) -> (Vec<SolvingStep>, Board) {
    let mut board = LogicalBoard::from_board(initial_board);
    let mut steps = Vec::new();

    loop {
        if let Some(step) = board.find_naked_single() {
            board.set_cell(step.placements[0].index, step.placements[0].value);
            steps.push(step);
            continue;
        }

        let mut hidden_single_found = false;
        for unit in ALL_UNITS.iter() {
            if let Some(step) = board.find_hidden_single_in_group(unit) {
                board.set_cell(step.placements[0].index, step.placements[0].value);
                steps.push(step);
                hidden_single_found = true;
                break;
            }
        }
        if hidden_single_found {
            continue;
        }

        if let Some(step) = board.find_naked_subset(2) {
            for elim in &step.eliminations {
                board.candidates[elim.index] &= !(1 << (elim.value - 1));
            }
            steps.push(step);
            continue;
        }
        if let Some(step) = board.find_pointing_subset() {
            for elim in &step.eliminations {
                board.candidates[elim.index] &= !(1 << (elim.value - 1));
            }
            steps.push(step);
            continue;
        }

        // Exit if no logical technique made progress.
        break;
    }

    (steps, Board { cells: board.cells })
}

/// Determines the logical difficulty of solving a board by finding the hardest
/// technique required to make any progress.
pub fn get_difficulty(initial_board: &Board) -> (TechniqueLevel, Board) {
    let (steps, final_board) = solve_with_steps(initial_board);

    let max_level = steps
        .iter()
        .map(|step| match step.technique.as_str() {
            "NakedSingle" | "HiddenSingle" => TechniqueLevel::Basic,
            "PointingPair" | "PointingTriple" | "NakedPair" => TechniqueLevel::Intermediate,
            _ => TechniqueLevel::None,
        })
        .max()
        .unwrap_or(TechniqueLevel::None);

    (max_level, final_board)
}
