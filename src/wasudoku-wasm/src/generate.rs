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
use crate::logical_solver::{self, TechniqueLevel};
use crate::solver;
use rand::rng;
use rand::seq::SliceRandom;

/// Represents the target difficulty of the generated puzzle.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Difficulty {
    Easy,
    Medium,
    Hard,
    Extreme,
}

/// Generate a complete, solved Sudoku board.
fn generate_full_solution() -> Board {
    let mut board = Board { cells: [0; 81] };
    let mut numbers: [u8; 9] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    numbers.shuffle(&mut rng());
    solver::solve_randomized(&mut board, &numbers);
    board
}

/// Attempts to generate an Easy or Medium puzzle from a given solution.
fn generate_easy_medium(solution: &Board, min_clues: usize) -> Board {
    let mut puzzle = *solution;
    let mut indices: Vec<usize> = (0..81).collect();
    indices.shuffle(&mut rng());

    let mut current_clues = 81;

    for index in indices {
        if current_clues <= min_clues {
            break;
        }

        let original_value = puzzle.cells[index];
        puzzle.cells[index] = 0;

        // Ensure the puzzle still has a unique solution.
        if solver::count_solutions(&puzzle) != 1 {
            puzzle.cells[index] = original_value;
            continue;
        }

        // Ensure the puzzle remains solvable with only basic techniques.
        let (level, _) = logical_solver::get_difficulty(&puzzle);
        if level <= TechniqueLevel::Basic {
            current_clues -= 1;
        } else {
            // This removal made the puzzle too hard, revert it.
            puzzle.cells[index] = original_value;
        }
    }
    puzzle
}

/// Creates a "minimal" puzzle from a solution by removing as many clues as possible while maintaining a unique solution.
fn create_minimal_puzzle(solution: &Board) -> Board {
    let mut puzzle = *solution;
    let mut indices: Vec<usize> = (0..81).collect();
    indices.shuffle(&mut rng());

    for index in indices {
        let original_value = puzzle.cells[index];
        puzzle.cells[index] = 0;
        if solver::count_solutions(&puzzle) != 1 {
            puzzle.cells[index] = original_value;
        }
    }
    puzzle
}

/// Creates a minimal puzzle optimized for hard/extreme generation.
fn create_minimal_puzzle_with_limit(solution: &Board, min_clues: usize) -> Board {
    let mut puzzle = *solution;
    let mut indices: Vec<usize> = (0..81).collect();
    indices.shuffle(&mut rng());
    let mut clues_remaining = 81;

    for index in indices {
        // Early exit when reaching the minimum clue threshold.
        if clues_remaining <= min_clues {
            break;
        }

        let original_value = puzzle.cells[index];
        puzzle.cells[index] = 0;
        if solver::count_solutions(&puzzle) != 1 {
            puzzle.cells[index] = original_value;
        } else {
            clues_remaining -= 1;
        }
    }
    puzzle
}

/// Attempts to generate a Hard puzzle from a given solution.
fn try_generate_hard(solution: &Board) -> Option<Board> {
    let minimal_puzzle = create_minimal_puzzle_with_limit(solution, 22);
    let (level, solved_board) = logical_solver::get_difficulty(&minimal_puzzle);

    // Hard puzzles should use intermediate techniques.
    if level == TechniqueLevel::Intermediate && is_solved(&solved_board) {
        Some(minimal_puzzle)
    } else {
        None
    }
}

/// Attempts to generate an Extreme puzzle from a given solution.
fn try_generate_extreme(solution: &Board) -> Option<Board> {
    let minimal_puzzle = create_minimal_puzzle(solution);
    let clues_count = minimal_puzzle.cells.iter().filter(|&&c| c != 0).count();

    if clues_count < 17 || clues_count > 35 {
        return None;
    }

    let (_level, solved_board) = logical_solver::get_difficulty(&minimal_puzzle);
    // Extreme puzzles should not be completely solvable by basic/intermediate techniques.
    let is_completely_solved = solved_board.cells.iter().all(|&c| c != 0);

    if is_completely_solved {
        None
    } else {
        Some(minimal_puzzle)
    }
}

/// Validates that a puzzle has a unique solution (for Easy/Medium difficulties).
fn validate_puzzle_uniqueness(puzzle: &Board, difficulty: Difficulty) -> bool {
    match difficulty {
        Difficulty::Easy | Difficulty::Medium => solver::count_solutions(puzzle) == 1,
        Difficulty::Hard | Difficulty::Extreme => true,
    }
}

/// Generates a puzzle of a specific difficulty.
pub fn generate(difficulty: Difficulty) -> Board {
    loop {
        let solution = generate_full_solution();

        let puzzle_candidate = match difficulty {
            Difficulty::Easy => Some(generate_easy_medium(&solution, 40)),
            Difficulty::Medium => Some(generate_easy_medium(&solution, 32)),
            Difficulty::Hard => try_generate_hard(&solution),
            Difficulty::Extreme => try_generate_extreme(&solution),
        };

        if let Some(puzzle) = puzzle_candidate {
            if validate_puzzle_uniqueness(&puzzle, difficulty) {
                return puzzle;
            }
        }
    }
}

fn is_solved(board: &Board) -> bool {
    board.cells.iter().all(|&cell| cell != 0)
}
