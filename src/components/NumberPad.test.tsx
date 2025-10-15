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

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  describe,
  expect,
  it,
  vi,
  type Mock,
  beforeEach,
} from 'vitest'
import { NumberPad } from './NumberPad'
import {
  useSudokuState,
  useSudokuDispatch,
} from '@/context/sudoku.hooks'
import { initialState } from '@/context/sudoku.reducer'

// Mocks
vi.mock('@/context/sudoku.hooks')

const mockUseSudokuState = useSudokuState as Mock
const mockUseSudokuDispatch = useSudokuDispatch as Mock

describe('NumberPad component', () => {
  const mockDispatch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSudokuState.mockReturnValue(initialState) // activeCellIndex is null
    mockUseSudokuDispatch.mockReturnValue(mockDispatch)
  })

  it('renders 9 number buttons', () => {
    render(<NumberPad />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(9)
    expect(
      screen.getByRole('button', { name: 'Enter number 1' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Enter number 9' }),
    ).toBeInTheDocument()
  })

  it('dispatches inputValue with the correct value when a cell is active', async () => {
    const user = userEvent.setup()
    mockUseSudokuState.mockReturnValue({ ...initialState, activeCellIndex: 10 })
    render(<NumberPad />)

    const button5 = screen.getByRole('button', { name: 'Enter number 5' })
    await user.click(button5)

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'INPUT_VALUE',
      value: 5,
    })
  })

  it('does not dispatch if no cell is active', async () => {
    const user = userEvent.setup()
    render(<NumberPad />)
    const button5 = screen.getByRole('button', { name: 'Enter number 5' })
    await user.click(button5)
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('disables all buttons when no cell is active', () => {
    render(<NumberPad />) // Initial state has activeCellIndex: null
    const buttons = screen.getAllByRole('button')
    buttons.forEach((button) => {
      expect(button).toBeDisabled()
    })
  })

  it('enables all buttons when a cell is active', () => {
    mockUseSudokuState.mockReturnValue({ ...initialState, activeCellIndex: 0 })
    render(<NumberPad />)
    const buttons = screen.getAllByRole('button')
    buttons.forEach((button) => {
      expect(button).not.toBeDisabled()
    })
  })
})
