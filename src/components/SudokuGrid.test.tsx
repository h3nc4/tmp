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
import { useSudokuState, useSudokuDispatch } from '@/context/sudoku.hooks'
import { useSudokuActions } from '@/hooks/useSudokuActions'
import { initialState } from '@/context/sudoku.reducer'
import * as sudokuActions from '@/context/sudoku.actions'
import type { SudokuState, CellState } from '@/context/sudoku.types'
import { toast } from 'sonner'

// Mocks
vi.mock('@/context/sudoku.hooks')
vi.mock('@/hooks/useSudokuActions')
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

interface MockSudokuCellProps {
  index: number
  onFocus: (index: number) => void
  isHighlighted: boolean
  isNumberHighlighted: boolean
  cell: CellState
  eliminatedCandidates?: ReadonlySet<number>
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
const mockUseSudokuActions = useSudokuActions as Mock

describe('SudokuGrid component', () => {
  const mockDispatch = vi.fn()
  const mockActions = {
    setActiveCell: vi.fn(),
    inputValue: vi.fn(),
    eraseActiveCell: vi.fn(),
    navigate: vi.fn(),
    setHighlightedValue: vi.fn(),
  }
  const defaultState: SudokuState = {
    ...initialState,
    ui: {
      ...initialState.ui,
      activeCellIndex: 0,
    },
    solver: {
      ...initialState.solver,
      visualizationBoard: initialState.board, // ensure it's not null
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockSudokuCellRender.mockClear()
    mockUseSudokuState.mockReturnValue(defaultState)
    mockUseSudokuDispatch.mockReturnValue(mockDispatch)
    mockUseSudokuActions.mockReturnValue(mockActions)
  })

  it('renders 81 SudokuCell components', () => {
    render(<SudokuGrid />)
    expect(mockSudokuCellRender).toHaveBeenCalledTimes(81)
  })

  it('does not render if displayBoard is null', () => {
    mockUseSudokuState.mockReturnValue({
      ...defaultState,
      solver: {
        ...defaultState.solver,
        gameMode: 'visualizing',
        visualizationBoard: null,
      },
    })
    const { container } = render(<SudokuGrid />)
    expect(container.firstChild).toBeNull()
  })

  it('calls setActiveCell when a cell is focused in playing mode', () => {
    render(<SudokuGrid />)
    const cell10 = screen.getByLabelText('cell-10')
    fireEvent.focus(cell10)
    expect(mockActions.setActiveCell).toHaveBeenCalledWith(10)
  })

  it('does not call setActiveCell when in visualizing mode', () => {
    mockUseSudokuState.mockReturnValue({
      ...defaultState,
      solver: {
        ...defaultState.solver,
        gameMode: 'visualizing',
      },
    })
    render(<SudokuGrid />)
    const cell10 = screen.getByLabelText('cell-10')
    fireEvent.focus(cell10)
    expect(mockActions.setActiveCell).not.toHaveBeenCalled()
  })

  it('calls setActiveCell with null when the grid loses focus', () => {
    render(<SudokuGrid />)
    const grid = screen.getByRole('grid')
    const outsideElement = document.createElement('button')
    document.body.appendChild(outsideElement)

    // Simulate focus moving from the grid to the outside element
    fireEvent.blur(grid, { relatedTarget: outsideElement })

    expect(mockActions.setActiveCell).toHaveBeenCalledWith(null)

    document.body.removeChild(outsideElement)
  })

  it('does not dispatch when focus moves to another cell within the grid', () => {
    render(<SudokuGrid />)
    const grid = screen.getByRole('grid')
    const cell1 = screen.getByLabelText('cell-1')
    mockActions.setActiveCell.mockClear() // Clear initial focus call

    // Simulate focus moving from one part of the grid to another
    fireEvent.blur(grid, { relatedTarget: cell1 })

    expect(mockActions.setActiveCell).not.toHaveBeenCalled()
  })

  it('does not highlight any cells when no cell is active', () => {
    mockUseSudokuState.mockReturnValue({
      ...defaultState,
      ui: { ...defaultState.ui, activeCellIndex: null },
    })
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
      ...defaultState,
      board: boardWithValues,
      ui: { ...defaultState.ui, highlightedValue: 5 },
    })
    render(<SudokuGrid />)

    const cell4Props = mockSudokuCellRender.mock.calls[4][0] // cell 4 has value 5
    expect(cell4Props.isNumberHighlighted).toBe(true)

    const cell5Props = mockSudokuCellRender.mock.calls[5][0] // cell 5 has value 6
    expect(cell5Props.isNumberHighlighted).toBe(false)
  })

  describe('Keyboard Interactions', () => {
    it('calls inputValue and setHighlightedValue on number key press', async () => {
      const user = userEvent.setup()
      render(<SudokuGrid />)
      await user.keyboard('{5}')
      expect(mockActions.inputValue).toHaveBeenCalledWith(5)
      expect(mockActions.setHighlightedValue).toHaveBeenCalledWith(5)
    })

    it('ignores keyboard input when in visualizing mode', async () => {
      mockUseSudokuState.mockReturnValue({
        ...defaultState,
        solver: { ...defaultState.solver, gameMode: 'visualizing' },
      })
      const user = userEvent.setup()
      render(<SudokuGrid />)
      await user.keyboard('{5}')
      expect(mockActions.inputValue).not.toHaveBeenCalled()
    })

    it.each([
      ['{ArrowUp}', 'up'],
      ['{ArrowDown}', 'down'],
      ['{ArrowLeft}', 'left'],
      ['{ArrowRight}', 'right'],
    ])('calls navigate for %s key', async (key, direction) => {
      const user = userEvent.setup()
      render(<SudokuGrid />)
      await user.keyboard(key)
      expect(mockActions.navigate).toHaveBeenCalledWith(direction)
    })

    it('handles Backspace to call eraseActiveCell("backspace")', async () => {
      const user = userEvent.setup()
      render(<SudokuGrid />)
      await user.keyboard('{Backspace}')
      expect(mockActions.eraseActiveCell).toHaveBeenCalledWith('backspace')
    })

    it('handles Delete to call eraseActiveCell("delete")', async () => {
      const user = userEvent.setup()
      render(<SudokuGrid />)
      await user.keyboard('{Delete}')
      expect(mockActions.eraseActiveCell).toHaveBeenCalledWith('delete')
    })
  })

  describe('Clipboard (Paste) Interactions', () => {
    const validBoardString = '.'.repeat(81)

    it('dispatches importBoard action on valid paste', async () => {
      // Spy on the method and control its return value for this test
      const readTextSpy = vi
        .spyOn(navigator.clipboard, 'readText')
        .mockResolvedValue(validBoardString)

      render(<SudokuGrid />)
      const grid = screen.getByRole('grid')
      // Trigger a paste event on the grid
      fireEvent.paste(grid)
      await act(async () => await Promise.resolve()) // Wait for async operations

      expect(readTextSpy).toHaveBeenCalled()
      expect(mockDispatch).toHaveBeenCalledWith(
        sudokuActions.importBoard(validBoardString),
      )
      expect(toast.success).toHaveBeenCalledWith('Board imported from clipboard.')
      readTextSpy.mockRestore()
    })

    it('shows an error toast for invalid paste string', async () => {
      const invalidString = 'abc'
      const readTextSpy = vi
        .spyOn(navigator.clipboard, 'readText')
        .mockResolvedValue(invalidString)

      render(<SudokuGrid />)
      const grid = screen.getByRole('grid')
      fireEvent.paste(grid)
      await act(async () => await Promise.resolve()) // Wait for async operations

      expect(mockDispatch).not.toHaveBeenCalled()
      expect(toast.error).toHaveBeenCalledWith('Invalid board format in clipboard.')
      readTextSpy.mockRestore()
    })

    it('shows an error toast if clipboard read fails', async () => {
      const readTextSpy = vi
        .spyOn(navigator.clipboard, 'readText')
        .mockRejectedValue(new Error('Read failed'))

      render(<SudokuGrid />)
      const grid = screen.getByRole('grid')
      fireEvent.paste(grid)
      await act(async () => await Promise.resolve())

      expect(mockDispatch).not.toHaveBeenCalled()
      expect(toast.error).toHaveBeenCalledWith('Could not read from clipboard.')
      readTextSpy.mockRestore()
    })
  })

  describe('when in visualizing mode', () => {
    it('passes correct candidates and eliminations to SudokuCell', () => {
      const mockElimination = { index: 1, value: 5 }
      const mockCandidates: (Set<number> | null)[] = Array(81).fill(null)
      mockCandidates[0] = new Set([2, 4])
      mockCandidates[1] = new Set([5, 7])

      const visualizingState: SudokuState = {
        ...defaultState,
        solver: {
          ...defaultState.solver,
          gameMode: 'visualizing',
          // Create a board where cell 0 has a value, but cell 1 and 2 are empty for testing candidates
          visualizationBoard: initialState.board.map((c, i) =>
            i === 0 ? { ...c, value: 9 } : c,
          ),
          candidatesForViz: mockCandidates,
          eliminationsForViz: [mockElimination],
        },
      }

      mockUseSudokuState.mockReturnValue(visualizingState)
      render(<SudokuGrid />)

      // Check props for cell 0, which has candidates
      const cell0Props = mockSudokuCellRender.mock.calls[0][0]
      expect(cell0Props.cell.candidates).toEqual(new Set([2, 4]))
      expect(cell0Props.eliminatedCandidates).toEqual(new Set()) // No eliminations for this cell

      // Check props for cell 1, which has an elimination
      const cell1Props = mockSudokuCellRender.mock.calls[1][0]
      expect(cell1Props.cell.candidates).toEqual(new Set([5, 7]))
      expect(cell1Props.eliminatedCandidates).toEqual(new Set([5]))

      // Check props for cell 2, which has null candidates in the array
      const cell2Props = mockSudokuCellRender.mock.calls[2][0]
      expect(cell2Props.cell.candidates).toEqual(new Set()) // Should default to empty set
      expect(cell2Props.eliminatedCandidates).toEqual(new Set())
    })

    it('handles null eliminationsForViz gracefully', () => {
      const visualizingState: SudokuState = {
        ...defaultState,
        solver: {
          ...defaultState.solver,
          gameMode: 'visualizing',
          visualizationBoard: initialState.board,
          candidatesForViz: [],
          eliminationsForViz: null, // Test this case
        },
      }

      mockUseSudokuState.mockReturnValue(visualizingState)
      render(<SudokuGrid />)

      const cell0Props = mockSudokuCellRender.mock.calls[0][0]
      expect(cell0Props.eliminatedCandidates).toEqual(new Set())
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
      mockUseSudokuState.mockReturnValue({
        ...defaultState,
        ui: { ...defaultState.ui, activeCellIndex: 5 },
      })
    })
    rerender(<SudokuGrid />)

    // The useEffect should trigger another focus call
    expect(focusSpy).toHaveBeenCalledTimes(2)

    focusSpy.mockRestore() // Clean up the spy
  })
})
