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
        for (i, row) in units.iter_mut().enumerate() {
            for (j, cell) in row.iter_mut().enumerate() {
                *cell = i * 9 + j;
            }
        }
        units
    };
    static ref COL_UNITS: [[usize; 9]; 9] = {
        let mut units = [[0; 9]; 9];
        for (i, row) in units.iter_mut().enumerate() {
            for (j, cell) in row.iter_mut().enumerate() {
                *cell = j * 9 + i;
            }
        }
        units
    };
    static ref BOX_UNITS: [[usize; 9]; 9] = {
        let mut units = [[0; 9]; 9];
        for (i, unit) in units.iter_mut().enumerate() {
            let start_row = (i / 3) * 3;
            let start_col = (i % 3) * 3;
            for (j, cell) in unit.iter_mut().enumerate() {
                *cell = (start_row + j / 3) * 9 + (start_col + j % 3);
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
        for (i, peers_vec) in map.iter_mut().enumerate() {
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
            *peers_vec = peers.into_iter().collect();
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
            if let Some(step) = self.try_find_hidden_single_for_number(group, num) {
                return Some(step);
            }
        }
        None
    }

    /// Try to find a hidden single for a specific number in a group.
    fn try_find_hidden_single_for_number(&self, group: &[usize], num: u8) -> Option<SolvingStep> {
        let mask = 1 << (num - 1);
        let potential_indices: Vec<usize> = group
            .iter()
            .filter(|&&index| self.cells[index] == 0 && (self.candidates[index] & mask) != 0)
            .cloned()
            .collect();

        if potential_indices.len() != 1 {
            return None;
        }

        let index = potential_indices[0];
        let value = num;
        let mut eliminations = self.collect_peer_eliminations(index, value);

        // Also eliminate other candidates from the cell itself.
        eliminations.extend(self.collect_cell_eliminations(index, value));

        Some(SolvingStep {
            technique: "HiddenSingle".to_string(),
            placements: vec![Placement { index, value }],
            eliminations,
            cause: vec![],
        })
    }

    /// Collect eliminations from peer cells for a given index and value.
    fn collect_peer_eliminations(&self, index: usize, value: u8) -> Vec<Elimination> {
        let mask = 1 << (value - 1);
        PEER_MAP[index]
            .iter()
            .filter(|&&p_idx| self.cells[p_idx] == 0 && (self.candidates[p_idx] & mask) != 0)
            .map(|&p_idx| Elimination {
                index: p_idx,
                value,
            })
            .collect()
    }

    /// Collect eliminations for other candidates in the same cell.
    fn collect_cell_eliminations(&self, index: usize, value: u8) -> Vec<Elimination> {
        (1..=9)
            .filter(|&cand| cand != value && (self.candidates[index] & (1 << (cand - 1))) != 0)
            .map(|cand| Elimination { index, value: cand })
            .collect()
    }

    /// Find Naked Subsets (Pairs, Triples) in any unit.
    /// A Naked Pair is two cells in the same unit that have the exact same two candidates.
    fn find_naked_subset(&self, size: usize) -> Option<SolvingStep> {
        let tech_name = self.get_technique_name(size);

        for unit in ALL_UNITS.iter() {
            if let Some(step) = self.find_naked_subset_in_unit(unit, size, &tech_name) {
                return Some(step);
            }
        }
        None
    }

    /// Get the technique name based on subset size.
    fn get_technique_name(&self, size: usize) -> String {
        format!(
            "Naked{}",
            match size {
                2 => "Pair",
                3 => "Triple",
                _ => "Subset",
            }
        )
    }

    /// Find a naked subset within a specific unit.
    fn find_naked_subset_in_unit(
        &self,
        unit: &[usize],
        size: usize,
        tech_name: &str,
    ) -> Option<SolvingStep> {
        let empty_cells: Vec<usize> = unit
            .iter()
            .filter(|&&i| self.cells[i] == 0 && self.candidates[i].count_ones() as usize <= size)
            .cloned()
            .collect();

        if empty_cells.len() <= size {
            return None;
        }

        // A simplified combination generator for pairs.
        if size == 2 {
            return self.find_naked_pair_in_cells(&empty_cells, unit, tech_name);
        }

        None
    }

    /// Find a naked pair within the given empty cells of a unit.
    fn find_naked_pair_in_cells(
        &self,
        empty_cells: &[usize],
        unit: &[usize],
        tech_name: &str,
    ) -> Option<SolvingStep> {
        for i in 0..empty_cells.len() {
            for j in (i + 1)..empty_cells.len() {
                let c1_idx = empty_cells[i];
                let c2_idx = empty_cells[j];

                if !self.is_valid_naked_pair(c1_idx, c2_idx) {
                    continue;
                }

                let combined_mask = self.candidates[c1_idx];
                let cause_cells = vec![c1_idx, c2_idx];
                let eliminations =
                    self.collect_naked_subset_eliminations(unit, &cause_cells, combined_mask);

                if !eliminations.is_empty() {
                    let cause_cands = mask_to_vec(combined_mask);
                    return Some(SolvingStep {
                        technique: tech_name.to_string(),
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
        None
    }

    /// Check if two cells form a valid naked pair.
    fn is_valid_naked_pair(&self, c1_idx: usize, c2_idx: usize) -> bool {
        self.candidates[c1_idx] == self.candidates[c2_idx]
            && self.candidates[c1_idx].count_ones() == 2
    }

    /// Collect eliminations for a naked subset.
    fn collect_naked_subset_eliminations(
        &self,
        unit: &[usize],
        cause_cells: &[usize],
        combined_mask: u16,
    ) -> Vec<Elimination> {
        let mut eliminations = Vec::new();

        for &cell_idx in unit.iter() {
            if cause_cells.contains(&cell_idx) || self.cells[cell_idx] != 0 {
                continue;
            }

            if (self.candidates[cell_idx] & combined_mask) != 0 {
                for cand in mask_to_vec(combined_mask) {
                    if (self.candidates[cell_idx] & (1 << (cand - 1))) != 0 {
                        eliminations.push(Elimination {
                            index: cell_idx,
                            value: cand,
                        });
                    }
                }
            }
        }

        eliminations
    }

    /// Find Pointing Pairs/Triples.
    /// This occurs when a candidate within a box is confined to a single row or column.
    fn find_pointing_subset(&self) -> Option<SolvingStep> {
        for box_unit in BOX_UNITS.iter() {
            for num in 1..=9 {
                if let Some(step) = self.try_find_pointing_subset_in_box(box_unit, num) {
                    return Some(step);
                }
            }
        }
        None
    }

    /// Try to find a pointing subset for a specific number in a box.
    fn try_find_pointing_subset_in_box(&self, box_unit: &[usize], num: u8) -> Option<SolvingStep> {
        let mask = 1 << (num - 1);
        let cells_with_cand: Vec<usize> = box_unit
            .iter()
            .filter(|&&i| self.cells[i] == 0 && (self.candidates[i] & mask) != 0)
            .cloned()
            .collect();

        if cells_with_cand.len() < 2 || cells_with_cand.len() > 3 {
            return None;
        }

        let first_row = cells_with_cand[0] / 9;
        let first_col = cells_with_cand[0] % 9;

        let all_in_same_row = cells_with_cand.iter().all(|&i| i / 9 == first_row);
        let all_in_same_col = cells_with_cand.iter().all(|&i| i % 9 == first_col);

        if all_in_same_row {
            return self.create_pointing_subset_step_for_row(
                box_unit,
                &cells_with_cand,
                first_row,
                num,
                mask,
            );
        }

        if all_in_same_col {
            return self.create_pointing_subset_step_for_col(
                box_unit,
                &cells_with_cand,
                first_col,
                num,
                mask,
            );
        }

        None
    }

    /// Create a pointing subset step for a row alignment.
    fn create_pointing_subset_step_for_row(
        &self,
        box_unit: &[usize],
        cells_with_cand: &[usize],
        first_row: usize,
        num: u8,
        mask: u16,
    ) -> Option<SolvingStep> {
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

        if elims.is_empty() {
            return None;
        }

        Some(self.build_pointing_subset_step(cells_with_cand, elims, num))
    }

    /// Create a pointing subset step for a column alignment.
    fn create_pointing_subset_step_for_col(
        &self,
        box_unit: &[usize],
        cells_with_cand: &[usize],
        first_col: usize,
        num: u8,
        mask: u16,
    ) -> Option<SolvingStep> {
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

        if elims.is_empty() {
            return None;
        }

        Some(self.build_pointing_subset_step(cells_with_cand, elims, num))
    }

    /// Build a SolvingStep for a pointing subset.
    fn build_pointing_subset_step(
        &self,
        cells_with_cand: &[usize],
        elims: Vec<Elimination>,
        num: u8,
    ) -> SolvingStep {
        let technique = if cells_with_cand.len() == 2 {
            "PointingPair".to_string()
        } else {
            "PointingTriple".to_string()
        };

        SolvingStep {
            technique,
            placements: vec![],
            eliminations: elims,
            cause: cells_with_cand
                .iter()
                .map(|&idx| CauseCell {
                    index: idx,
                    candidates: vec![num],
                })
                .collect(),
        }
    }
}

/// Solve the board by repeatedly applying logical techniques and return the steps.
pub fn solve_with_steps(initial_board: &Board) -> (Vec<SolvingStep>, Board) {
    let mut board = LogicalBoard::from_board(initial_board);
    let mut steps = Vec::new();

    loop {
        let progress = try_naked_single(&mut board, &mut steps)
            || try_hidden_single(&mut board, &mut steps)
            || try_naked_pair(&mut board, &mut steps)
            || try_pointing_subset(&mut board, &mut steps);

        if !progress {
            break;
        }
    }

    (steps, Board { cells: board.cells })
}

/// Try to apply a naked single technique.
fn try_naked_single(board: &mut LogicalBoard, steps: &mut Vec<SolvingStep>) -> bool {
    if let Some(step) = board.find_naked_single() {
        board.set_cell(step.placements[0].index, step.placements[0].value);
        steps.push(step);
        return true;
    }
    false
}

/// Try to apply a hidden single technique across all units.
fn try_hidden_single(board: &mut LogicalBoard, steps: &mut Vec<SolvingStep>) -> bool {
    for unit in ALL_UNITS.iter() {
        if let Some(step) = board.find_hidden_single_in_group(unit) {
            board.set_cell(step.placements[0].index, step.placements[0].value);
            steps.push(step);
            return true;
        }
    }
    false
}

/// Try to apply a naked pair technique.
fn try_naked_pair(board: &mut LogicalBoard, steps: &mut Vec<SolvingStep>) -> bool {
    if let Some(step) = board.find_naked_subset(2) {
        for elim in &step.eliminations {
            board.candidates[elim.index] &= !(1 << (elim.value - 1));
        }
        steps.push(step);
        return true;
    }
    false
}

/// Try to apply a pointing subset technique.
fn try_pointing_subset(board: &mut LogicalBoard, steps: &mut Vec<SolvingStep>) -> bool {
    if let Some(step) = board.find_pointing_subset() {
        for elim in &step.eliminations {
            board.candidates[elim.index] &= !(1 << (elim.value - 1));
        }
        steps.push(step);
        return true;
    }
    false
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
