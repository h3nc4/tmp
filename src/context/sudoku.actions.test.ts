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

import { describe, it, expect } from 'vitest'
import * as actions from './sudoku.actions'
import type { SudokuAction } from './sudoku.actions.types'
import type { SolveResult } from './sudoku.types'

describe('Sudoku Action Creators', () => {
  it('should create a SET_CELL_VALUE action', () => {
    const expectedAction: SudokuAction = {
      type: 'SET_CELL_VALUE',
      index: 0,
      value: 5,
    }
    expect(actions.setCellValue(0, 5)).toEqual(expectedAction)
  })

  it('should create a TOGGLE_PENCIL_MARK action', () => {
    const expectedAction: SudokuAction = {
      type: 'TOGGLE_PENCIL_MARK',
      index: 1,
      value: 3,
      mode: 'candidate',
    }
    expect(actions.togglePencilMark(1, 3, 'candidate')).toEqual(expectedAction)
  })

  it('should create an ERASE_CELL action', () => {
    const expectedAction: SudokuAction = { type: 'ERASE_CELL', index: 2 }
    expect(actions.eraseCell(2)).toEqual(expectedAction)
  })

  it('should create a CLEAR_BOARD action', () => {
    const expectedAction: SudokuAction = { type: 'CLEAR_BOARD' }
    expect(actions.clearBoard()).toEqual(expectedAction)
  })

  it('should create an UNDO action', () => {
    const expectedAction: SudokuAction = { type: 'UNDO' }
    expect(actions.undo()).toEqual(expectedAction)
  })

  it('should create a REDO action', () => {
    const expectedAction: SudokuAction = { type: 'REDO' }
    expect(actions.redo()).toEqual(expectedAction)
  })

  it('should create a SOLVE_START action', () => {
    const expectedAction: SudokuAction = { type: 'SOLVE_START' }
    expect(actions.solveStart()).toEqual(expectedAction)
  })

  it('should create a SOLVE_SUCCESS action', () => {
    const mockResult: SolveResult = {
      steps: [],
      solution: '1'.repeat(81),
    }
    const expectedAction: SudokuAction = {
      type: 'SOLVE_SUCCESS',
      result: mockResult,
    }
    expect(actions.solveSuccess(mockResult)).toEqual(expectedAction)
  })

  it('should create a SOLVE_FAILURE action', () => {
    const expectedAction: SudokuAction = { type: 'SOLVE_FAILURE' }
    expect(actions.solveFailure()).toEqual(expectedAction)
  })

  it('should create a GENERATE_PUZZLE_START action', () => {
    const expectedAction: SudokuAction = {
      type: 'GENERATE_PUZZLE_START',
      difficulty: 'easy',
    }
    expect(actions.generatePuzzleStart('easy')).toEqual(expectedAction)
  })

  it('should create a GENERATE_PUZZLE_SUCCESS action', () => {
    const puzzleString = '.'.repeat(81)
    const expectedAction: SudokuAction = {
      type: 'GENERATE_PUZZLE_SUCCESS',
      puzzleString,
    }
    expect(actions.generatePuzzleSuccess(puzzleString)).toEqual(expectedAction)
  })

  it('should create a GENERATE_PUZZLE_FAILURE action', () => {
    const expectedAction: SudokuAction = { type: 'GENERATE_PUZZLE_FAILURE' }
    expect(actions.generatePuzzleFailure()).toEqual(expectedAction)
  })

  it('should create a SET_ACTIVE_CELL action', () => {
    const expectedAction: SudokuAction = { type: 'SET_ACTIVE_CELL', index: 10 }
    expect(actions.setActiveCell(10)).toEqual(expectedAction)
  })

  it('should create a SET_INPUT_MODE action', () => {
    const expectedAction: SudokuAction = {
      type: 'SET_INPUT_MODE',
      mode: 'center',
    }
    expect(actions.setInputMode('center')).toEqual(expectedAction)
  })

  it('should create a CLEAR_ERROR action', () => {
    const expectedAction: SudokuAction = { type: 'CLEAR_ERROR' }
    expect(actions.clearError()).toEqual(expectedAction)
  })

  it('should create a SET_HIGHLIGHTED_VALUE action', () => {
    const expectedAction: SudokuAction = {
      type: 'SET_HIGHLIGHTED_VALUE',
      value: 8,
    }
    expect(actions.setHighlightedValue(8)).toEqual(expectedAction)
  })

  it('should create a VIEW_SOLVER_STEP action', () => {
    const expectedAction: SudokuAction = { type: 'VIEW_SOLVER_STEP', index: 5 }
    expect(actions.viewSolverStep(5)).toEqual(expectedAction)
  })

  it('should create an EXIT_VISUALIZATION action', () => {
    const expectedAction: SudokuAction = { type: 'EXIT_VISUALIZATION' }
    expect(actions.exitVisualization()).toEqual(expectedAction)
  })
})
