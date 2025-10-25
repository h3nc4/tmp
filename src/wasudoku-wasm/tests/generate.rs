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

use wasudoku_wasm::generate::{self, Difficulty};
use wasudoku_wasm::logical_solver::{self, TechniqueLevel};
use wasudoku_wasm::solver;

#[test]
fn test_generate_creates_valid_puzzle() {
    let puzzle = generate::generate(Difficulty::Easy);
    assert_eq!(
        solver::count_solutions(&puzzle),
        1,
        "Generated puzzle must have exactly one solution."
    );
    assert!(
        puzzle.cells.iter().any(|&c| c != 0),
        "Generated puzzle should not be empty."
    );
    assert!(
        puzzle.cells.iter().any(|&c| c == 0),
        "Generated puzzle should not be full."
    );
}

#[test]
fn test_generate_easy_puzzle_difficulty() {
    let puzzle = generate::generate(Difficulty::Easy);
    let (level, _) = logical_solver::get_difficulty(&puzzle);

    assert_eq!(
        level,
        TechniqueLevel::Basic,
        "Easy puzzle must be solvable with Basic techniques only, but was {:?}.",
        level
    );

    let clue_count = puzzle.cells.iter().filter(|&&c| c != 0).count();
    assert!(
        clue_count >= 40,
        "Easy puzzles should have at least 40 clues (got {})",
        clue_count
    );
}

#[test]
fn test_generate_medium_puzzle_difficulty() {
    let puzzle = generate::generate(Difficulty::Medium);
    let (level, _) = logical_solver::get_difficulty(&puzzle);

    assert_eq!(
        level,
        TechniqueLevel::Basic,
        "Medium puzzle must be solvable with Basic techniques only, but was {:?}.",
        level
    );

    let clue_count = puzzle.cells.iter().filter(|&&c| c != 0).count();
    assert!(
        clue_count >= 32,
        "Medium puzzles should have at least 32 clues (got {})",
        clue_count
    );
}

#[test]
fn test_generate_hard_puzzle_difficulty() {
    let puzzle = generate::generate(Difficulty::Hard);
    let (level, solved_board) = logical_solver::get_difficulty(&puzzle);

    assert_eq!(
        level,
        TechniqueLevel::Intermediate,
        "Hard puzzle must require Intermediate techniques, but was {:?}.",
        level
    );

    assert!(
        solved_board.cells.iter().all(|&c| c != 0),
        "Hard puzzle must be solvable without backtracking."
    );
}

#[test]
fn test_generate_extreme_puzzle_difficulty() {
    let puzzle = generate::generate(Difficulty::Extreme);
    assert_eq!(
        solver::count_solutions(&puzzle),
        1,
        "Extreme puzzle must still have a unique solution."
    );

    let (_level, solved_board) = logical_solver::get_difficulty(&puzzle);

    let is_completely_solved = solved_board.cells.iter().all(|&c| c != 0);
    assert!(
        !is_completely_solved,
        "Extreme puzzle must NOT be completely solvable with only basic/intermediate techniques."
    );

    let clue_count = puzzle.cells.iter().filter(|&&c| c != 0).count();
    assert!(
        clue_count >= 17 && clue_count <= 35,
        "Extreme puzzle should have between 17-35 clues (got {}).",
        clue_count
    );
}
