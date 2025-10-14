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
import { getRelatedCellIndices, isMoveValid, validateBoard } from './utils'

describe('Sudoku Utilities', () => {
  describe('getRelatedCellIndices', () => {
    it('should return the correct indices for a corner cell (0)', () => {
      const related = getRelatedCellIndices(0)
      const expected = new Set([
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 18, 19, 20, 27, 36, 45, 54, 63,
        72,
      ])
      // A cell is related to 20 other cells + itself
      expect(related.size).toBe(21)
      expect(related).toEqual(expected)
    })

    it('should return the correct indices for a center cell (40)', () => {
      const actualRelated = getRelatedCellIndices(40) // row 4, col 4
      expect(actualRelated.size).toBe(21)
      // Check a few key members from each group
      expect(actualRelated).toContain(36) // start of row
      expect(actualRelated).toContain(44) // end of row
      expect(actualRelated).toContain(4) // start of col
      expect(actualRelated).toContain(76) // end of col
      expect(actualRelated).toContain(30) // start of box
      expect(actualRelated).toContain(50) // end of box
    })

    it('should return an empty set for an out-of-bounds index', () => {
      expect(getRelatedCellIndices(-1).size).toBe(0)
      expect(getRelatedCellIndices(81).size).toBe(0)
    })
  })

  describe('validateBoard', () => {
    const EMPTY_BOARD = Array(81).fill(null)

    it('should find no conflicts on an empty board', () => {
      const conflicts = validateBoard(EMPTY_BOARD)
      expect(conflicts.size).toBe(0)
    })

    it('should find a conflict in a row', () => {
      const board = [...EMPTY_BOARD]
      board[0] = 5
      board[8] = 5
      const conflicts = validateBoard(board)
      expect(conflicts).toEqual(new Set([0, 8]))
    })

    it('should find a conflict in a column', () => {
      const board = [...EMPTY_BOARD]
      board[0] = 3
      board[72] = 3 // same column
      const conflicts = validateBoard(board)
      expect(conflicts).toEqual(new Set([0, 72]))
    })

    it('should find a conflict in a box', () => {
      const board = [...EMPTY_BOARD]
      board[0] = 7
      board[20] = 7 // same 3x3 box
      const conflicts = validateBoard(board)
      expect(conflicts).toEqual(new Set([0, 20]))
    })

    it('should find multiple conflicts across different groups', () => {
      const board = [...EMPTY_BOARD]
      // Row conflict
      board[0] = 1
      board[1] = 1
      // Col conflict
      board[2] = 2
      board[11] = 2
      // Box conflict
      board[30] = 3
      board[31] = 3

      const conflicts = validateBoard(board)
      expect(conflicts).toEqual(new Set([0, 1, 2, 11, 30, 31]))
    })
  })

  describe('isMoveValid', () => {
    const board: (number | null)[] = [
      // 0  1  2 | 3  4  5 | 6  7  8
      //---------|---------|---------
      5, 3, null, null, 7, null, null, null, null, // 0
      6, null, null, 1, 9, 5, null, null, null, // 1
      null, 9, 8, null, null, null, null, 6, null, // 2
      //---------|---------|---------
      8, null, null, null, 6, null, null, null, 3, // 3
      4, null, null, 8, null, 3, null, null, 1, // 4
      7, null, null, null, 2, null, null, null, 6, // 5
      //---------|---------|---------
      null, 6, null, null, null, null, 2, 8, null, // 6
      null, null, null, 4, 1, 9, null, null, 5, // 7
      null, null, null, null, 8, null, null, 7, 9, // 8
    ]

    it('should return true for a valid move', () => {
      // Placing a 4 in cell 2 (row 0, col 2) is valid
      expect(isMoveValid(board, 2, 4)).toBe(true)
    })

    it('should return false for a move that conflicts with the row', () => {
      // Placing a 5 in cell 2 conflicts with cell 0
      expect(isMoveValid(board, 2, 5)).toBe(false)
    })

    it('should return false for a move that conflicts with the column', () => {
      // Placing an 8 in cell 2 (row 0, col 2) conflicts with cell 20 (row 2, col 2)
      expect(isMoveValid(board, 2, 8)).toBe(false)
    })

    it('should return false for a move that conflicts with the box', () => {
      // Placing a 6 in cell 2 (row 0, col 2) conflicts with cell 9 (row 1, col 0)
      expect(isMoveValid(board, 2, 6)).toBe(false)
    })

    it('should not conflict with itself when checking a filled cell', () => {
      // This ensures the check `peerIndex !== index` is working correctly.
      expect(isMoveValid(board, 0, 5)).toBe(true)
    })
  })
})
