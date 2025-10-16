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

import React from 'react'
import { render, fireEvent, act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest'
import { SudokuGrid } from './SudokuGrid'
import {
  useSudokuState,
  useSudokuDispatch,
} from '@/context/sudoku.hooks'
import { initialState } from '@/context/sudoku.reducer'
import * as actions from '@/context/sudoku.actions'

// Mocks
vi.mock('@/context/sudoku.hooks')

interface MockSudokuCellProps {
  index: number
  onFocus: (index: number) => void
  isHighlighted: boolean
  isNumberHighlighted: boolean
}

// This spy will be called by the mocked SudokuCell component on each render.
const mockSudokuCellRender = vi.fn()

vi.mock('./SudokuCell', () => ({
  default: React.forwardRef<HTMLInputElement, MockSudokuCellProps>(
    (props, ref) => {
      mockSudokuCellRender(props) // Call spy to track renders and props
      return (
        <input
          ref={ref}
          aria-label={`cell-${props.index}`}
          onFocus={() => props.onFocus(props.index)}
        />
      )
    },
  ),
}))

const mockUseSudokuState = useSudokuState as Mock
const mockUseSudokuDispatch = useSudokuDispatch as Mock

describe('SudokuGrid component', () => {
  const mockDispatch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockSudokuCellRender.mockClear() // Clear the render spy
    mockUseSudokuState.mockReturnValue({ ...initialState, activeCellIndex: 0 })
    mockUseSudokuDispatch.mockReturnValue(mockDispatch)
  })

  it('renders 81 SudokuCell components', () => {
    render(<SudokuGrid />)
    expect(mockSudokuCellRender).toHaveBeenCalledTimes(81)
  })

  it('dispatches SET_ACTIVE_CELL with null when the grid loses focus', () => {
    render(<SudokuGrid />)
    const grid = screen.getByRole('grid')
    const outsideElement = document.createElement('button')
    document.body.appendChild(outsideElement)

    mockDispatch.mockClear()

    // Simulate focus moving from the grid to the outside element
    fireEvent.blur(grid, { relatedTarget: outsideElement })

    expect(mockDispatch).toHaveBeenCalledWith(actions.setActiveCell(null))

    document.body.removeChild(outsideElement)
  })

  it('does not dispatch when focus moves to another cell within the grid', () => {
    render(<SudokuGrid />)
    const grid = screen.getByRole('grid')
    const cell1 = screen.getByLabelText('cell-1')

    mockDispatch.mockClear()

    // Simulate focus moving from one part of the grid to another
    fireEvent.blur(grid, { relatedTarget: cell1 })

    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('does not highlight any cells when no cell is active', () => {
    mockUseSudokuState.mockReturnValue({ ...initialState, activeCellIndex: null })
    render(<SudokuGrid />)

    // Check the props of the first rendered cell
    const firstCellProps = mockSudokuCellRender.mock.calls[0][0]
    expect(firstCellProps.isHighlighted).toBe(false)

    // Check the props of the last rendered cell
    const lastCellProps = mockSudokuCellRender.mock.calls[80][0]
    expect(lastCellProps.isHighlighted).toBe(false)
  })

  it('passes isNumberHighlighted correctly', () => {
    const boardWithValues = initialState.board.map((cell, index) => ({
      ...cell,
      value: index % 9 + 1,
    }))
    mockUseSudokuState.mockReturnValue({
      ...initialState,
      board: boardWithValues,
      highlightedValue: 5,
    })
    render(<SudokuGrid />)

    const cell4Props = mockSudokuCellRender.mock.calls[4][0] // cell 4 has value 5
    expect(cell4Props.isNumberHighlighted).toBe(true)

    const cell5Props = mockSudokuCellRender.mock.calls[5][0] // cell 5 has value 6
    expect(cell5Props.isNumberHighlighted).toBe(false)
  })

  describe('Keyboard Interactions', () => {
    it('dispatches inputValue on number key press', async () => {
      const user = userEvent.setup()
      render(<SudokuGrid />)
      mockDispatch.mockClear()
      await user.keyboard('{5}')
      expect(mockDispatch).toHaveBeenCalledWith(actions.inputValue(5))
    })

    it('ignores keyboard input when solving', async () => {
      mockUseSudokuState.mockReturnValue({
        ...initialState,
        isSolving: true,
        activeCellIndex: 0,
      })
      const user = userEvent.setup()
      render(<SudokuGrid />)
      mockDispatch.mockClear() // Clear the dispatch from the initial render's useEffect

      await user.keyboard('{5}')
      expect(mockDispatch).not.toHaveBeenCalled()
    })

    it('ignores keyboard input when no cell is active', async () => {
      mockUseSudokuState.mockReturnValue({ ...initialState, activeCellIndex: null })
      const user = userEvent.setup()
      render(<SudokuGrid />)
      // No dispatch on render because activeCellIndex is null
      await user.keyboard('{5}')
      expect(mockDispatch).not.toHaveBeenCalled()
    })

    it.each([
      ['{ArrowUp}', 'up'],
      ['{ArrowDown}', 'down'],
      ['{ArrowLeft}', 'left'],
      ['{ArrowRight}', 'right'],
    ])('dispatches navigate action for %s key', async (key, direction) => {
      const user = userEvent.setup()
      render(<SudokuGrid />)
      mockDispatch.mockClear()
      await user.keyboard(key)
      expect(mockDispatch).toHaveBeenCalledWith(actions.navigate(direction as 'up'))
    })

    it('handles Backspace to dispatch eraseActiveCell("backspace")', async () => {
      const user = userEvent.setup()
      render(<SudokuGrid />)
      mockDispatch.mockClear()

      await user.keyboard('{Backspace}')
      expect(mockDispatch).toHaveBeenCalledWith(actions.eraseActiveCell('backspace'))
    })

    it('handles Delete to dispatch eraseActiveCell("delete")', async () => {
      const user = userEvent.setup()
      render(<SudokuGrid />)
      mockDispatch.mockClear()

      await user.keyboard('{Delete}')
      expect(mockDispatch).toHaveBeenCalledWith(actions.eraseActiveCell('delete'))
    })
  })

  it('focuses the correct cell when activeCellIndex changes', () => {
    // Spy on the focus method of all input elements
    const focusSpy = vi.spyOn(window.HTMLInputElement.prototype, 'focus')
    const { rerender } = render(<SudokuGrid />)

    // The initial render with activeCellIndex: 0 should trigger one focus call
    expect(focusSpy).toHaveBeenCalledTimes(1)

    // Rerender with a new active cell index
    act(() => {
      mockUseSudokuState.mockReturnValue({ ...initialState, activeCellIndex: 5 })
    })
    rerender(<SudokuGrid />)

    // The useEffect should trigger another focus call
    expect(focusSpy).toHaveBeenCalledTimes(2)

    focusSpy.mockRestore() // Clean up the spy
  })
})
