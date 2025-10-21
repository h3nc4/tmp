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

import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { BoardState } from '@/context/sudoku.types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * For a given cell index, returns a set of all indices in the same row, column, and 3x3 box.
 * @param index - The index of the cell (0-80).
 * @returns A Set of indices related to the given cell.
 */
export function getRelatedCellIndices(index: number): Set<number> {
  if (index < 0 || index > 80) return new Set()

  const relatedIndices = new Set<number>()
  const row = Math.floor(index / 9)
  const col = index % 9

  // Add row indices
  for (let i = 0; i < 9; i++) {
    relatedIndices.add(row * 9 + i)
  }

  // Add column indices
  for (let i = 0; i < 9; i++) {
    relatedIndices.add(i * 9 + col)
  }

  // Add 3x3 box indices
  const startRow = Math.floor(row / 3) * 3
  const startCol = Math.floor(col / 3) * 3
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      relatedIndices.add((startRow + i) * 9 + (startCol + j))
    }
  }

  return relatedIndices
}

const ROW_INDICES = Array.from({ length: 9 }, (_, i) =>
  Array.from({ length: 9 }, (_, k) => i * 9 + k),
)

const COL_INDICES = Array.from({ length: 9 }, (_, i) =>
  Array.from({ length: 9 }, (_, k) => k * 9 + i),
)

const BOX_INDICES = Array.from({ length: 9 }, (_, i) => {
  const startRow = Math.floor(i / 3) * 3
  const startCol = (i % 3) * 3
  const indices: number[] = []
  for (let rowOffset = 0; rowOffset < 3; rowOffset++) {
    for (let colOffset = 0; colOffset < 3; colOffset++) {
      indices.push((startRow + rowOffset) * 9 + (startCol + colOffset))
    }
  }
  return indices
})

/**
 * Validates the entire Sudoku board and returns a set of indices of cells that are in conflict.
 * A conflict occurs if a number appears more than once in the same row, column, or 3x3 box.
 * @param board - The Sudoku board array.
 * @returns A Set of indices of all cells involved in a conflict.
 */
export function validateBoard(board: BoardState): Set<number> {
  const conflicts = new Set<number>()

  const checkGroup = (indices: readonly number[]) => {
    const seen = new Map<number, number[]>() // Map from number to array of indices
    for (const index of indices) {
      const value = board[index].value
      if (value !== null) {
        if (!seen.has(value)) {
          seen.set(value, [])
        }
        seen.get(value)!.push(index)
      }
    }

    for (const indicesWithSameValue of seen.values()) {
      if (indicesWithSameValue.length > 1) {
        indicesWithSameValue.forEach((index) => conflicts.add(index))
      }
    }
  }

  // Check all rows, columns, and boxes
  ROW_INDICES.forEach(checkGroup)
  COL_INDICES.forEach(checkGroup)
  BOX_INDICES.forEach(checkGroup)

  return conflicts
}

/**
 * Checks if placing a number in a specific cell would create an immediate conflict.
 * This is a lighter-weight check than `validateBoard` as it only checks the peers of a single cell
 * against the board state *before* the new value is committed.
 * @param board The Sudoku board array.
 * @param index The index of the cell to check.
 * @param value The number to place in the cell.
 * @returns `true` if the move is valid (no immediate conflict), `false` otherwise.
 */
export function isMoveValid(
  board: BoardState,
  index: number,
  value: number,
): boolean {
  const row = Math.floor(index / 9)
  const col = index % 9

  // Check row for conflict
  for (let i = 0; i < 9; i++) {
    const peerIndex = row * 9 + i
    if (peerIndex !== index && board[peerIndex].value === value) {
      return false
    }
  }

  // Check column for conflict
  for (let i = 0; i < 9; i++) {
    const peerIndex = i * 9 + col
    if (peerIndex !== index && board[peerIndex].value === value) {
      return false
    }
  }

  // Check 3x3 box for conflict
  const startRow = Math.floor(row / 3) * 3
  const startCol = Math.floor(col / 3) * 3
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const peerIndex = (startRow + i) * 9 + (startCol + j)
      if (peerIndex !== index && board[peerIndex].value === value) {
        return false
      }
    }
  }

  return true
}

/**
 * Compares two sets for equality.
 * @param setA The first set.
 * @param setB The second set.
 * @returns `true` if the sets contain the same elements, `false` otherwise.
 */
function areSetsEqual<T>(
  setA: ReadonlySet<T>,
  setB: ReadonlySet<T>,
): boolean {
  if (setA.size !== setB.size) {
    return false
  }
  for (const item of setA) {
    if (!setB.has(item)) {
      return false
    }
  }
  return true
}

/**
 * Compares two board states for equality.
 * @param boardA The first board state.
 * @param boardB The second board state.
 * @returns `true` if the boards are identical, `false` otherwise.
 */
export function areBoardsEqual(
  boardA: BoardState,
  boardB: BoardState,
): boolean {
  if (boardA === boardB) return true
  if (boardA.length !== boardB.length) return false

  for (let i = 0; i < boardA.length; i++) {
    const cellA = boardA[i]
    const cellB = boardB[i]

    if (
      cellA.value !== cellB.value ||
      !areSetsEqual(cellA.candidates, cellB.candidates) ||
      !areSetsEqual(cellA.centers, cellB.centers)
    ) {
      return false
    }
  }

  return true
}

/**
 * Calculates the initial set of possible candidates for every cell on the board.
 * @param board The board state with initial values.
 * @returns An array where each element is a Set of candidates for that cell, or null if the cell is filled.
 */
export function calculateCandidates(
  board: BoardState,
): Array<Set<number> | null> {
  const candidates: Array<Set<number> | null> = Array(81)
    .fill(null)
    .map(() => new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]))

  for (let i = 0; i < 81; i++) {
    const cellValue = board[i].value
    if (cellValue !== null) {
      candidates[i] = null // Cell is filled
      const peers = getRelatedCellIndices(i)
      peers.forEach((peerIndex) => {
        if (peerIndex !== i) {
          candidates[peerIndex]?.delete(cellValue)
        }
      })
    }
  }
  return candidates
}
