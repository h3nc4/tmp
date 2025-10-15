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

import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { SudokuGrid } from './SudokuGrid'
import type { BoardState } from '@/hooks/useSudoku'
import SudokuCell from './SudokuCell'

// Mock the child component to isolate SudokuGrid logic
vi.mock('./SudokuCell', () => ({
  // Render a simple input to make it findable, but we'll check props
  default: vi.fn(({ index, onFocus, onChange }) => (
    <input
      aria-label={`cell-${index}`}
      onFocus={() => onFocus(index)}
      onChange={(e) => onChange(index, e.target.value)}
    />
  )),
}))

const MockedSudokuCell = SudokuCell as unknown as Mock

// Helper to create an empty board
const createEmptyBoard = (): BoardState =>
  Array(81)
    .fill(null)
    .map(() => ({
      value: null,
      candidates: new Set<number>(),
      centers: new Set<number>(),
    }))

describe('SudokuGrid component', () => {
  const mockOnCellChange = vi.fn()
  const mockOnCellFocus = vi.fn()

  const defaultProps = {
    board: createEmptyBoard(),
    initialBoard: createEmptyBoard(),
    isSolving: false,
    isSolved: false,
    conflicts: new Set<number>(),
    activeCellIndex: null,
    inputMode: 'normal' as const,
    onCellChange: mockOnCellChange,
    onCellFocus: mockOnCellFocus,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders 81 SudokuCell components', () => {
    render(<SudokuGrid {...defaultProps} />)
    expect(MockedSudokuCell).toHaveBeenCalledTimes(81)
  })

  it('correctly determines isInitial prop for cells', () => {
    const initialBoard = createEmptyBoard().map((cell, index) =>
      index === 5 ? { ...cell, value: 7 } : cell,
    )

    const board = createEmptyBoard().map((cell, index) => {
      if (index === 5) return { ...cell, value: 7 } // Initial cell
      if (index === 10) return { ...cell, value: 3 } // User-entered cell
      return cell
    })

    render(
      <SudokuGrid {...defaultProps} board={board} initialBoard={initialBoard} />,
    )

    // Cell 5 was in initialBoard, so isInitial should be true
    expect(MockedSudokuCell.mock.calls[5][0].isInitial).toBe(true)
    // Cell 10 was not, so isInitial should be false
    expect(MockedSudokuCell.mock.calls[10][0].isInitial).toBe(false)
    // An empty cell should also have isInitial: false
    expect(MockedSudokuCell.mock.calls[0][0].isInitial).toBe(false)
  })

  it('highlights related cells when a cell is active', () => {
    render(<SudokuGrid {...defaultProps} activeCellIndex={10} />) // Row 1, Col 1

    // Cell 10 itself is active
    expect(MockedSudokuCell.mock.calls[10][0].isActive).toBe(true)
    expect(MockedSudokuCell.mock.calls[10][0].isHighlighted).toBe(true)

    // Cell 11 is in the same row
    expect(MockedSudokuCell.mock.calls[11][0].isActive).toBe(false)
    expect(MockedSudokuCell.mock.calls[11][0].isHighlighted).toBe(true)

    // Cell 19 is in the same column
    expect(MockedSudokuCell.mock.calls[19][0].isActive).toBe(false)
    expect(MockedSudokuCell.mock.calls[19][0].isHighlighted).toBe(true)

    // Cell 0 is in the same box
    expect(MockedSudokuCell.mock.calls[0][0].isActive).toBe(false)
    expect(MockedSudokuCell.mock.calls[0][0].isHighlighted).toBe(true)

    // Cell 80 is unrelated
    expect(MockedSudokuCell.mock.calls[80][0].isActive).toBe(false)
    expect(MockedSudokuCell.mock.calls[80][0].isHighlighted).toBe(false)
  })

  it('does not highlight any cells when no cell is active', () => {
    render(<SudokuGrid {...defaultProps} activeCellIndex={null} />)

    for (let i = 0; i < 81; i++) {
      expect(MockedSudokuCell.mock.calls[i][0].isActive).toBe(false)
      expect(MockedSudokuCell.mock.calls[i][0].isHighlighted).toBe(false)
    }
  })

  it('calls onCellFocus with null when clicking outside the grid', () => {
    render(
      <div>
        <button>Outside</button>
        <SudokuGrid {...defaultProps} activeCellIndex={10} />
      </div>,
    )

    fireEvent.mouseDown(screen.getByText('Outside'))
    expect(mockOnCellFocus).toHaveBeenCalledWith(null)
  })

  it('does not call onCellFocus with null when clicking inside the grid', () => {
    render(<SudokuGrid {...defaultProps} activeCellIndex={10} />)
    const gridContainer = screen.getByRole('grid')
    fireEvent.mouseDown(gridContainer)
    expect(mockOnCellFocus).not.toHaveBeenCalled()
  })

  it('removes event listener on unmount', () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const removeSpy = vi.spyOn(document, 'removeEventListener')

    const { unmount } = render(<SudokuGrid {...defaultProps} />)

    expect(addSpy).toHaveBeenCalledWith('mousedown', expect.any(Function))

    unmount()

    expect(removeSpy).toHaveBeenCalledWith('mousedown', addSpy.mock.calls[0][1])

    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})
