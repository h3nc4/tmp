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
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest'
import { UndoRedo } from './UndoRedo'
import {
  useSudokuState,
  useSudokuDispatch,
} from '@/context/sudoku.hooks'
import { initialState } from '@/context/sudoku.reducer'

// Mocks
vi.mock('@/context/sudoku.hooks')

const mockUseSudokuState = useSudokuState as Mock
const mockUseSudokuDispatch = useSudokuDispatch as Mock

describe('UndoRedo component', () => {
  const mockDispatch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSudokuState.mockReturnValue(initialState)
    mockUseSudokuDispatch.mockReturnValue(mockDispatch)
  })

  it('disables both buttons with initial state', () => {
    render(<UndoRedo />)
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled()
  })

  it('enables Undo button when historyIndex > 0', () => {
    mockUseSudokuState.mockReturnValue({
      ...initialState,
      historyIndex: 1,
      history: [initialState.board, initialState.board], // 2 states
    })
    render(<UndoRedo />)
    expect(screen.getByRole('button', { name: 'Undo' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled()
  })

  it('enables Redo button when not at the end of history', () => {
    mockUseSudokuState.mockReturnValue({
      ...initialState,
      historyIndex: 0,
      history: [initialState.board, initialState.board], // 2 states
    })
    render(<UndoRedo />)
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Redo' })).not.toBeDisabled()
  })

  it('dispatches UNDO action on click', async () => {
    const user = userEvent.setup()
    mockUseSudokuState.mockReturnValue({
      ...initialState,
      historyIndex: 1,
      history: [initialState.board, initialState.board],
    })
    render(<UndoRedo />)

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'UNDO' })
  })

  it('dispatches REDO action on click', async () => {
    const user = userEvent.setup()
    mockUseSudokuState.mockReturnValue({
      ...initialState,
      historyIndex: 0,
      history: [initialState.board, initialState.board],
    })
    render(<UndoRedo />)

    await user.click(screen.getByRole('button', { name: 'Redo' }))
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'REDO' })
  })
})
