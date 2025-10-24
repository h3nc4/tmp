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
import type { SudokuState, CellState, SolvingStep } from '@/context/sudoku.types'
import { toast } from 'sonner'

vi.mock('@/context/sudoku.hooks')
vi.mock('@/hooks/useSudokuActions')
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

interface MockSudokuCellProps {
  index: number
  onFocus: (index: number) => void
  isHighlighted: boolean
  isNumberHighlighted: boolean
  isCause: boolean
  cell: CellState
  eliminatedCandidates?: ReadonlySet<number>
}

const mockSudokuCellRender = vi.fn()

vi.mock('./SudokuCell', () => ({
  default: React.forwardRef<HTMLInputElement, MockSudokuCellProps>(
    (props, ref) => {
      mockSudokuCellRender(props)
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
      visualizationBoard: initialState.board,
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

    fireEvent.blur(grid, { relatedTarget: outsideElement })

    expect(mockActions.setActiveCell).toHaveBeenCalledWith(null)

    document.body.removeChild(outsideElement)
  })

  it('does not dispatch when focus moves to another cell within the grid', () => {
    render(<SudokuGrid />)
    const grid = screen.getByRole('grid')
    const cell1 = screen.getByLabelText('cell-1')
    mockActions.setActiveCell.mockClear()

    fireEvent.blur(grid, { relatedTarget: cell1 })

    expect(mockActions.setActiveCell).not.toHaveBeenCalled()
  })

  it('does not highlight any cells when no cell is active', () => {
    mockUseSudokuState.mockReturnValue({
      ...defaultState,
      ui: { ...defaultState.ui, activeCellIndex: null },
    })
    render(<SudokuGrid />)

    const firstCellProps = mockSudokuCellRender.mock.calls[0][0]
    expect(firstCellProps.isHighlighted).toBe(false)

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

    const cell4Props = mockSudokuCellRender.mock.calls[4][0]
    expect(cell4Props.isNumberHighlighted).toBe(true)

    const cell5Props = mockSudokuCellRender.mock.calls[5][0]
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
      const readTextSpy = vi
        .spyOn(navigator.clipboard, 'readText')
        .mockResolvedValue(validBoardString)

      render(<SudokuGrid />)
      const grid = screen.getByRole('grid')
      fireEvent.paste(grid)
      await act(async () => await Promise.resolve())

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
      await act(async () => await Promise.resolve())

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
          visualizationBoard: initialState.board.map((c, i) =>
            i === 0 ? { ...c, value: 9 } : c,
          ),
          candidatesForViz: mockCandidates,
          eliminationsForViz: [mockElimination],
        },
      }

      mockUseSudokuState.mockReturnValue(visualizingState)
      render(<SudokuGrid />)

      const cell0Props = mockSudokuCellRender.mock.calls[0][0]
      expect(cell0Props.cell.candidates).toEqual(new Set([2, 4]))
      expect(cell0Props.eliminatedCandidates).toEqual(new Set())

      const cell1Props = mockSudokuCellRender.mock.calls[1][0]
      expect(cell1Props.cell.candidates).toEqual(new Set([5, 7]))
      expect(cell1Props.eliminatedCandidates).toEqual(new Set([5]))

      const cell2Props = mockSudokuCellRender.mock.calls[2][0]
      expect(cell2Props.cell.candidates).toEqual(new Set())
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
          eliminationsForViz: null,
        },
      }

      mockUseSudokuState.mockReturnValue(visualizingState)
      render(<SudokuGrid />)

      const cell0Props = mockSudokuCellRender.mock.calls[0][0]
      expect(cell0Props.eliminatedCandidates).toEqual(new Set())
    })
  })

  describe('causeIndices calculation', () => {
    const mockStep: SolvingStep = {
      technique: 'NakedPair',
      placements: [],
      eliminations: [],
      cause: [
        { index: 10, candidates: [1, 2] },
        { index: 11, candidates: [1, 2] },
      ],
    }

    it('passes isCause=true to the correct cells', () => {
      const visualizingState: SudokuState = {
        ...defaultState,
        solver: {
          ...defaultState.solver,
          gameMode: 'visualizing',
          visualizationBoard: initialState.board,
          steps: [mockStep],
          currentStepIndex: 1,
        },
      }
      mockUseSudokuState.mockReturnValue(visualizingState)
      render(<SudokuGrid />)

      const cell10Props = mockSudokuCellRender.mock.calls[10][0]
      const cell11Props = mockSudokuCellRender.mock.calls[11][0]
      const cell12Props = mockSudokuCellRender.mock.calls[12][0]

      expect(cell10Props.isCause).toBe(true)
      expect(cell11Props.isCause).toBe(true)
      expect(cell12Props.isCause).toBe(false)
    })

    it('returns an empty set if currentStepIndex is 0', () => {
      const visualizingState: SudokuState = {
        ...defaultState,
        solver: {
          ...defaultState.solver,
          gameMode: 'visualizing',
          visualizationBoard: initialState.board,
          steps: [mockStep],
          currentStepIndex: 0,
        },
      }
      mockUseSudokuState.mockReturnValue(visualizingState)
      render(<SudokuGrid />)

      mockSudokuCellRender.mock.calls.forEach((call) => {
        const props = call[0] as MockSudokuCellProps
        expect(props.isCause).toBe(false)
      })
    })

    it('returns an empty set if the current step has no cause property', () => {
      const stepWithoutCause: SolvingStep = {
        technique: 'NakedSingle',
        placements: [],
        eliminations: [],
        cause: undefined as unknown as [],
      }
      const visualizingState: SudokuState = {
        ...defaultState,
        solver: {
          ...defaultState.solver,
          gameMode: 'visualizing',
          visualizationBoard: initialState.board,
          steps: [stepWithoutCause],
          currentStepIndex: 1,
        },
      }
      mockUseSudokuState.mockReturnValue(visualizingState)
      render(<SudokuGrid />)

      mockSudokuCellRender.mock.calls.forEach((call) => {
        const props = call[0] as MockSudokuCellProps
        expect(props.isCause).toBe(false)
      })
    })
  })


  it('focuses the correct cell when activeCellIndex changes', () => {
    const focusSpy = vi.spyOn(window.HTMLInputElement.prototype, 'focus')
    const { rerender } = render(<SudokuGrid />)

    expect(focusSpy).toHaveBeenCalledTimes(1)

    act(() => {
      mockUseSudokuState.mockReturnValue({
        ...defaultState,
        ui: { ...defaultState.ui, activeCellIndex: 5 },
      })
    })
    rerender(<SudokuGrid />)

    expect(focusSpy).toHaveBeenCalledTimes(2)

    focusSpy.mockRestore()
  })
})
