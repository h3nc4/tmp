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

import { renderHook, act } from '@testing-library/react'
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  beforeAll,
  afterAll,
  type Mock,
} from 'vitest'
import { toast } from 'sonner'
import { useSudokuActions } from './useSudokuActions'
import {
  useSudokuState,
  useSudokuDispatch,
} from '@/context/sudoku.hooks'
import { initialState } from '@/context/sudoku.reducer'
import * as actionCreators from '@/context/sudoku.actions'
import type { SudokuState } from '@/context/sudoku.types'
import { isMoveValid } from '@/lib/utils'

vi.mock('@/context/sudoku.hooks')
vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils')>()
  return {
    ...actual,
    isMoveValid: vi.fn(),
  }
})
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const mockUseSudokuState = useSudokuState as Mock
const mockUseSudokuDispatch = useSudokuDispatch as Mock
const mockIsMoveValid = vi.mocked(isMoveValid)

describe('useSudokuActions', () => {
  const mockDispatch = vi.fn()
  const defaultState: SudokuState = {
    ...initialState,
    ui: {
      ...initialState.ui,
      activeCellIndex: 0,
    },
  }

  const mockClipboard = {
    writeText: vi.fn(),
    readText: vi.fn(),
  }

  beforeAll(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: mockClipboard,
      configurable: true,
    })
  })

  afterAll(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    })
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockClipboard.writeText.mockResolvedValue(undefined)
    mockUseSudokuState.mockReturnValue(defaultState)
    mockUseSudokuDispatch.mockReturnValue(mockDispatch)
    mockIsMoveValid.mockReturnValue(true) // Default to valid moves
  })

  // Helper to get the current actions from the hook
  const getActions = () => {
    const { result } = renderHook(() => useSudokuActions())
    return result.current
  }

  describe('inputValue', () => {
    it('dispatches setCellValue and advances focus in normal mode on a valid move', () => {
      const actions = getActions()
      act(() => actions.inputValue(5))

      expect(mockDispatch).toHaveBeenCalledWith(actionCreators.setCellValue(0, 5))
      expect(mockDispatch).toHaveBeenCalledWith(actionCreators.setActiveCell(1))
    })

    it('dispatches setCellValue but does not advance focus on an invalid move', () => {
      mockIsMoveValid.mockReturnValue(false)
      const actions = getActions()
      act(() => actions.inputValue(5))

      expect(mockDispatch).toHaveBeenCalledWith(actionCreators.setCellValue(0, 5))
      expect(mockDispatch).not.toHaveBeenCalledWith(
        actionCreators.setActiveCell(1),
      )
    })

    it('dispatches togglePencilMark in candidate mode', () => {
      mockUseSudokuState.mockReturnValue({
        ...defaultState,
        ui: { ...defaultState.ui, inputMode: 'candidate' },
      })
      const actions = getActions()
      act(() => actions.inputValue(3))

      expect(mockDispatch).toHaveBeenCalledWith(
        actionCreators.togglePencilMark(0, 3, 'candidate'),
      )
    })

    it('does not dispatch anything if no cell is active', () => {
      mockUseSudokuState.mockReturnValue({
        ...defaultState,
        ui: { ...defaultState.ui, activeCellIndex: null },
      })
      const actions = getActions()
      act(() => actions.inputValue(5))

      expect(mockDispatch).not.toHaveBeenCalled()
    })
  })

  describe('navigate', () => {
    it.each([
      ['right', 0, 1],
      ['left', 1, 0],
      ['down', 0, 9],
      ['up', 9, 0],
    ])(
      'dispatches setActiveCell for direction %s from %i to %i',
      (direction, startIndex, expectedIndex) => {
        mockUseSudokuState.mockReturnValue({
          ...defaultState,
          ui: { ...defaultState.ui, activeCellIndex: startIndex },
        })
        const actions = getActions()
        act(() => actions.navigate(direction as 'right'))

        expect(mockDispatch).toHaveBeenCalledWith(
          actionCreators.setActiveCell(expectedIndex),
        )
      },
    )

    it('does not dispatch if navigation is not possible', () => {
      mockUseSudokuState.mockReturnValue({
        ...defaultState,
        ui: { ...defaultState.ui, activeCellIndex: 80 },
      })
      const actions = getActions()
      act(() => actions.navigate('right'))

      expect(mockDispatch).not.toHaveBeenCalled()
    })

    it('does not dispatch if no cell is active', () => {
      mockUseSudokuState.mockReturnValue({
        ...defaultState,
        ui: { ...defaultState.ui, activeCellIndex: null },
      })
      const actions = getActions()
      act(() => actions.navigate('right'))
      expect(mockDispatch).not.toHaveBeenCalled()
    })
  })

  describe('eraseActiveCell', () => {
    it('dispatches eraseCell and moves left for "backspace"', () => {
      mockUseSudokuState.mockReturnValue({
        ...defaultState,
        ui: { ...defaultState.ui, activeCellIndex: 1 },
      })
      const actions = getActions()
      act(() => actions.eraseActiveCell('backspace'))

      expect(mockDispatch).toHaveBeenCalledWith(actionCreators.eraseCell(1))
      expect(mockDispatch).toHaveBeenCalledWith(actionCreators.setActiveCell(0))
    })

    it('dispatches eraseCell and does not move for "delete"', () => {
      const actions = getActions()
      act(() => actions.eraseActiveCell('delete'))

      expect(mockDispatch).toHaveBeenCalledWith(actionCreators.eraseCell(0))
      expect(mockDispatch).not.toHaveBeenCalledWith(
        actionCreators.setActiveCell(expect.any(Number)),
      )
    })

    it('does not dispatch if no cell is active', () => {
      mockUseSudokuState.mockReturnValue({
        ...defaultState,
        ui: { ...defaultState.ui, activeCellIndex: null },
      })
      const actions = getActions()
      act(() => actions.eraseActiveCell('delete'))
      expect(mockDispatch).not.toHaveBeenCalled()
    })
  })

  describe('exportBoard', () => {
    it('calls clipboard.writeText with the correct board string and shows toast', async () => {
      const boardWithValues = initialState.board.map((cell, index) => {
        if (index === 0) return { ...cell, value: 5 }
        if (index === 80) return { ...cell, value: 9 }
        return cell
      })
      mockUseSudokuState.mockReturnValue({ ...defaultState, board: boardWithValues })

      const actions = getActions()
      await act(async () => {
        actions.exportBoard()
      })
      const expectedString = '5' + '.'.repeat(79) + '9'
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expectedString)
      expect(toast.success).toHaveBeenCalledWith('Board exported to clipboard.')
    })

    it('shows an error toast if clipboard write fails', async () => {
      mockClipboard.writeText.mockRejectedValue(new Error('Write failed'))
      const actions = getActions()
      await act(async () => {
        actions.exportBoard()
      })
      expect(toast.error).toHaveBeenCalledWith('Failed to copy board to clipboard.')
    })

    it('shows an error toast if clipboard API is not available', async () => {
      const originalClipboard = navigator.clipboard
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        configurable: true,
      })

      const actions = getActions()
      await act(async () => {
        actions.exportBoard()
      })
      expect(toast.error).toHaveBeenCalledWith(
        'Clipboard API not available in this browser or context.',
      )
      Object.defineProperty(navigator, 'clipboard', { value: originalClipboard })
    })
  })

  describe('Direct Actions', () => {
    it('setActiveCell dispatches SET_ACTIVE_CELL', () => {
      const actions = getActions()
      act(() => actions.setActiveCell(10))
      expect(mockDispatch).toHaveBeenCalledWith(actionCreators.setActiveCell(10))
    })

    it('clearBoard dispatches CLEAR_BOARD', () => {
      const actions = getActions()
      act(() => actions.clearBoard())
      expect(mockDispatch).toHaveBeenCalledWith(actionCreators.clearBoard())
    })

    it('undo dispatches UNDO', () => {
      const actions = getActions()
      act(() => actions.undo())
      expect(mockDispatch).toHaveBeenCalledWith(actionCreators.undo())
    })

    it('redo dispatches REDO', () => {
      const actions = getActions()
      act(() => actions.redo())
      expect(mockDispatch).toHaveBeenCalledWith(actionCreators.redo())
    })

    it('solve dispatches SOLVE_START', () => {
      const actions = getActions()
      act(() => actions.solve())
      expect(mockDispatch).toHaveBeenCalledWith(actionCreators.solveStart())
    })

    it('generatePuzzle dispatches GENERATE_PUZZLE_START', () => {
      const actions = getActions()
      act(() => actions.generatePuzzle('easy'))
      expect(mockDispatch).toHaveBeenCalledWith(
        actionCreators.generatePuzzleStart('easy'),
      )
    })

    it('exitVisualization dispatches EXIT_VISUALIZATION', () => {
      const actions = getActions()
      act(() => actions.exitVisualization())
      expect(mockDispatch).toHaveBeenCalledWith(
        actionCreators.exitVisualization(),
      )
    })

    it('setInputMode dispatches SET_INPUT_MODE', () => {
      const actions = getActions()
      act(() => actions.setInputMode('candidate'))
      expect(mockDispatch).toHaveBeenCalledWith(
        actionCreators.setInputMode('candidate'),
      )
    })

    it('setHighlightedValue dispatches SET_HIGHLIGHTED_VALUE', () => {
      const actions = getActions()
      act(() => actions.setHighlightedValue(5))
      expect(mockDispatch).toHaveBeenCalledWith(
        actionCreators.setHighlightedValue(5),
      )
    })

    it('viewSolverStep dispatches VIEW_SOLVER_STEP', () => {
      const actions = getActions()
      act(() => actions.viewSolverStep(3))
      expect(mockDispatch).toHaveBeenCalledWith(actionCreators.viewSolverStep(3))
    })
  })
})
