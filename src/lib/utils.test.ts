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

import { describe, expect, it } from 'vitest'
import type { BoardState, CellState } from '@/context/sudoku.types'
import {
  areBoardsEqual,
  boardStateFromString,
  boardStateToString,
  calculateCandidates,
  formatCell,
  getRelatedCellIndices,
  isBoardStringValid,
  isMoveValid,
  validateBoard,
} from './utils'

// Helper to create an empty board with the new structure
const createEmptyCell = (): CellState => ({
  value: null,
  candidates: new Set(),
  centers: new Set(),
})
const createEmptyBoard = (): BoardState => Array(81).fill(0).map(createEmptyCell)

describe('Sudoku Utilities', () => {
  describe('getRelatedCellIndices', () => {
    it('should return the correct indices for a corner cell (0)', () => {
      const related = getRelatedCellIndices(0)
      const expected = new Set([
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 18, 19, 20, 27, 36, 45, 54, 63, 72,
      ])
      expect(related.size).toBe(21)
      expect(related).toEqual(expected)
    })

    it('should return an empty set for an out-of-bounds index', () => {
      expect(getRelatedCellIndices(-1).size).toBe(0)
      expect(getRelatedCellIndices(81).size).toBe(0)
    })
  })

  describe('formatCell', () => {
    it('should format index 0 as R1C1', () => {
      expect(formatCell(0)).toBe('R1C1')
    })
    it('should format index 80 as R9C9', () => {
      expect(formatCell(80)).toBe('R9C9')
    })
    it('should format index 10 as R2C2', () => {
      expect(formatCell(10)).toBe('R2C2')
    })
  })

  describe('validateBoard', () => {
    it('should find no conflicts on an empty board', () => {
      const conflicts = validateBoard(createEmptyBoard())
      expect(conflicts.size).toBe(0)
    })

    it('should find a conflict in a row', () => {
      const board = createEmptyBoard().map((cell: CellState, index: number) => {
        if (index === 0 || index === 8) return { ...cell, value: 5 }
        return cell
      })
      const conflicts = validateBoard(board)
      expect(conflicts).toEqual(new Set([0, 8]))
    })
  })

  describe('isMoveValid', () => {
    const baseBoard = createEmptyBoard()
    const board: BoardState = baseBoard.map((cell: CellState, index: number) => {
      const values: { [key: number]: number } = {
        0: 5,
        1: 3,
        4: 7,
        9: 6,
        12: 1,
        13: 9,
        14: 5,
        19: 9,
        20: 8,
        25: 6,
      }
      return values[index] ? { ...cell, value: values[index] } : cell
    })

    it('should return true for a valid move', () => {
      // Placing a 4 in cell 2 (row 0, col 2) is valid
      expect(isMoveValid(board, 2, 4)).toBe(true)
    })

    it('should return false for a move that conflicts with the row', () => {
      // Placing a 5 in cell 2 conflicts with cell 0
      expect(isMoveValid(board, 2, 5)).toBe(false)
    })

    it('should return false for a move that conflicts with the column', () => {
      // Placing an 8 in cell 2 (row 0, col 2) conflicts with cell 20
      expect(isMoveValid(board, 2, 8)).toBe(false)
    })

    it('should return false for a move that conflicts with the box', () => {
      // Placing a 6 in cell 2 (row 0, col 2) conflicts with cell 9
      expect(isMoveValid(board, 2, 6)).toBe(false)
    })
  })

  describe('areBoardsEqual', () => {
    it('should return true for identical boards', () => {
      const board1 = createEmptyBoard()
      const board2 = createEmptyBoard()
      expect(areBoardsEqual(board1, board2)).toBe(true)
    })

    it('should return true for the same board instance', () => {
      const board1 = createEmptyBoard()
      expect(areBoardsEqual(board1, board1)).toBe(true)
    })

    it('should return false for boards of different lengths', () => {
      const board1 = createEmptyBoard()
      const board2 = createEmptyBoard().slice(0, 80)
      expect(areBoardsEqual(board1, board2)).toBe(false)
    })

    it('should return false for boards with different values', () => {
      const board1 = createEmptyBoard()
      const board2 = createEmptyBoard().map((cell, i) => (i === 0 ? { ...cell, value: 5 } : cell))
      expect(areBoardsEqual(board1, board2)).toBe(false)
    })

    it('should return false for boards with different candidates', () => {
      const board1 = createEmptyBoard()
      const board2 = createEmptyBoard().map((cell, i) =>
        i === 0 ? { ...cell, candidates: new Set([1]) } : cell,
      )
      expect(areBoardsEqual(board1, board2)).toBe(false)
    })

    it('should return false for boards with different centers', () => {
      const board1 = createEmptyBoard()
      const board2 = createEmptyBoard().map((cell, i) =>
        i === 0 ? { ...cell, centers: new Set([1]) } : cell,
      )
      expect(areBoardsEqual(board1, board2)).toBe(false)
    })

    it('should return false for boards with different candidate set contents but same size', () => {
      const board1 = createEmptyBoard().map((cell, i) =>
        i === 0 ? { ...cell, candidates: new Set([1]) } : cell,
      )
      const board2 = createEmptyBoard().map((cell, i) =>
        i === 0 ? { ...cell, candidates: new Set([2]) } : cell,
      )
      expect(areBoardsEqual(board1, board2)).toBe(false)
    })

    it('should return false for boards with different center set contents but same size', () => {
      const board1 = createEmptyBoard().map((cell, i) =>
        i === 0 ? { ...cell, centers: new Set([1]) } : cell,
      )
      const board2 = createEmptyBoard().map((cell, i) =>
        i === 0 ? { ...cell, centers: new Set([2]) } : cell,
      )
      expect(areBoardsEqual(board1, board2)).toBe(false)
    })
  })

  describe('calculateCandidates', () => {
    it('should return a full set for empty cells on an empty board', () => {
      const board = createEmptyBoard()
      const candidates = calculateCandidates(board)
      const allNumbers = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9])
      expect(candidates[0]).toEqual(allNumbers)
      expect(candidates[80]).toEqual(allNumbers)
    })

    it('should return null for filled cells', () => {
      const board = createEmptyBoard().map((cell, i) => (i === 0 ? { ...cell, value: 5 } : cell))
      const candidates = calculateCandidates(board)
      expect(candidates[0]).toBeNull()
    })

    it('should eliminate candidates from peers of a filled cell', () => {
      const board = createEmptyBoard().map((cell, i) => (i === 0 ? { ...cell, value: 5 } : cell))
      const candidates = calculateCandidates(board)

      // Cell 1 (same row) should not have 5 as a candidate
      expect(candidates[1]?.has(5)).toBe(false)
      // Cell 9 (same column) should not have 5 as a candidate
      expect(candidates[9]?.has(5)).toBe(false)
      // Cell 10 (same box) should not have 5 as a candidate
      expect(candidates[10]?.has(5)).toBe(false)
      // Cell 80 (not a peer) should still have 5 as a candidate
      expect(candidates[80]?.has(5)).toBe(true)
    })
  })

  describe('boardStateToString', () => {
    it('should convert a board state to a string', () => {
      const board = createEmptyBoard().map((cell, i) => {
        if (i === 0) return { ...cell, value: 5 }
        if (i === 2) return { ...cell, value: 9 }
        return cell
      })
      const expected = '5.9' + '.'.repeat(78)
      expect(boardStateToString(board)).toBe(expected)
    })
  })

  describe('boardStateFromString', () => {
    it('should parse a valid string into a board state', () => {
      const boardString = '5.9' + '.'.repeat(78)
      const board = boardStateFromString(boardString)
      expect(board.length).toBe(81)
      expect(board[0].value).toBe(5)
      expect(board[1].value).toBe(null)
      expect(board[2].value).toBe(9)
      expect(board[0].candidates.size).toBe(0)
      expect(board[0].centers.size).toBe(0)
    })
  })

  describe('isBoardStringValid', () => {
    it('should return true for a valid string', () => {
      expect(isBoardStringValid('.'.repeat(81))).toBe(true)
      expect(isBoardStringValid('123456789'.repeat(9))).toBe(true)
    })

    it('should return false for a string with incorrect length', () => {
      expect(isBoardStringValid('.'.repeat(80))).toBe(false)
    })

    it('should return false for a string with invalid characters', () => {
      expect(isBoardStringValid('a'.repeat(81))).toBe(false)
    })
  })
})
