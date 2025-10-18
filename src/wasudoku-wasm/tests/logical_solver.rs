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

use wasudoku_wasm::board::Board;
use wasudoku_wasm::logical_solver::{self, LogicalBoard};
use wasudoku_wasm::solver;
use wasudoku_wasm::types::Elimination;

/// Helper to create a `LogicalBoard` from a string for testing.
fn board_from_str(s: &str) -> LogicalBoard {
    let simple_board = Board::from_str(s).unwrap();
    LogicalBoard::from_board(&simple_board)
}

#[test]
fn test_candidate_initialization() {
    let puzzle_str =
        "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";
    let board = board_from_str(puzzle_str);

    // Cell (0,0) has value 5, so it should have 0 candidates.
    assert_eq!(board.candidates[0], 0);

    // Cell (0,2) is empty. It's in a row with 5,3,7, a col with 6,9,8, etc.
    // Let's check if 5 is eliminated. Mask for 5 is 1 << 4.
    let mask_for_5 = 1 << 4;
    assert_eq!(board.candidates[2] & mask_for_5, 0);

    // Check if 1 is a valid candidate for (0,2)
    let mask_for_1 = 1 << 0;
    assert_ne!(board.candidates[2] & mask_for_1, 0);
}

#[test]
fn test_naked_single_step_generation() {
    // This puzzle's first logical move is a naked single.
    let puzzle_str =
        "...2..7...5..96832.8.7....641.....78.2..745..7.31854....2531..4.3164..5...9...61.";
    let initial_board = Board::from_str(puzzle_str).unwrap();
    let (steps, _) = logical_solver::solve_with_steps(&initial_board);

    assert!(!steps.is_empty());
    let first_step = &steps[0];
    assert_eq!(first_step.technique, "NakedSingle");
    assert_eq!(first_step.placements.len(), 1);
    let placement = &first_step.placements[0];
    assert_eq!(placement.index, 9);
    assert_eq!(placement.value, 1);

    // Check that eliminations were correctly identified.
    // Placing 1 at index 9 (R1C0) should eliminate 1 from its peers in the same box, like index 0.
    let has_elimination_for_cell_0 = first_step
        .eliminations
        .iter()
        .any(|e| e.index == 0 && e.value == 1);
    assert!(
        has_elimination_for_cell_0,
        "Expected elimination of 1 at index 0"
    );
}

#[test]
fn test_hidden_single_detection_in_box() {
    // A puzzle where the first logical step is a hidden single.
    let puzzle_str =
        ".38.917.571...38.9...78.3419738526148649175325213..9781..67..83386.29.57..7.38.96";
    let initial_board = Board::from_str(puzzle_str).unwrap();
    let (steps, _) = logical_solver::solve_with_steps(&initial_board);

    assert!(!steps.is_empty());
    let first_step = &steps[0];
    assert_eq!(first_step.technique, "HiddenSingle");
    assert_eq!(first_step.placements.len(), 1);
    let placement = &first_step.placements[0];
    assert_eq!(placement.index, 0);
    assert_eq!(placement.value, 4);

    // Check that eliminations were correctly identified.
    // Placing 4 at index 0 should eliminate other candidates from cell 0 (2, 6).
    let elims: Vec<&Elimination> = first_step
        .eliminations
        .iter()
        .filter(|e| e.index == 0)
        .collect();
    assert_eq!(elims.len(), 2, "Expected 2 eliminations from cell 0");
    assert!(elims.iter().any(|e| e.value == 2));
    assert!(elims.iter().any(|e| e.value == 6));
}

/// Replicates the hybrid solving logic from `lib.rs` for native testing.
fn solve_natively(puzzle_str: &str) -> Option<Board> {
    let initial_board = Board::from_str(puzzle_str).ok()?;
    let (_, mut board_after_logic) = logical_solver::solve_with_steps(&initial_board);

    if !board_after_logic.cells.contains(&0) {
        return Some(board_after_logic);
    }

    if solver::solve(&mut board_after_logic) {
        Some(board_after_logic)
    } else {
        None
    }
}

#[test]
fn test_hybrid_solver_logic_solves_puzzle() {
    // An easy puzzle that can be solved entirely by naked and hidden singles.
    let puzzle_str =
        "...2..7...5..96832.8.7....641.....78.2..745..7.31854....2531..4.3164..5...9...61.";
    let solution_str =
        "396218745157496832284753196415962378928374561763185429672531984831649257549827613";

    let result = solve_natively(puzzle_str);
    assert!(result.is_some());
    assert_eq!(result.unwrap().to_string(), solution_str);
}

#[test]
fn test_hybrid_solver_falls_back_to_backtracking() {
    // A very hard puzzle that the current logical solver cannot finish.
    let puzzle_str =
        "8..........36......7..9.2...5...7.......457.....1...3...1....68..85...1..9....4..";
    let solution_str =
        "812753649943682175675491283154237896369845721287169534521974368438526917796318452";

    let result = solve_natively(puzzle_str);
    assert!(result.is_some());
    assert_eq!(result.unwrap().to_string(), solution_str);
}
