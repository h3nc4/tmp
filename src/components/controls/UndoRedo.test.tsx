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
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { UndoRedo } from './UndoRedo'
import { useSudokuState } from '@/context/sudoku.hooks'
import { useSudokuActions } from '@/hooks/useSudokuActions'
import { initialState } from '@/context/sudoku.reducer'
import type { SudokuState } from '@/context/sudoku.types'

vi.mock('@/context/sudoku.hooks')
vi.mock('@/hooks/useSudokuActions')

const mockUseSudokuState = useSudokuState as Mock
const mockUseSudokuActions = useSudokuActions as Mock

describe('UndoRedo component', () => {
  const mockUndo = vi.fn()
  const mockRedo = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSudokuState.mockReturnValue(initialState)
    mockUseSudokuActions.mockReturnValue({
      undo: mockUndo,
      redo: mockRedo,
    })
  })

  it('disables both buttons with initial state', () => {
    render(<UndoRedo />)
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled()
  })

  it('enables Undo button when history.index > 0', () => {
    mockUseSudokuState.mockReturnValue({
      ...initialState,
      history: {
        index: 1,
        stack: [initialState.board, initialState.board], // 2 states
      },
    })
    render(<UndoRedo />)
    expect(screen.getByRole('button', { name: 'Undo' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled()
  })

  it('enables Redo button when not at the end of history', () => {
    mockUseSudokuState.mockReturnValue({
      ...initialState,
      history: {
        index: 0,
        stack: [initialState.board, initialState.board], // 2 states
      },
    })
    render(<UndoRedo />)
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Redo' })).not.toBeDisabled()
  })

  it('disables both buttons when in visualizing mode, even if history exists', () => {
    const state: SudokuState = {
      ...initialState,
      history: {
        index: 1,
        stack: [initialState.board, initialState.board, initialState.board],
      },
      solver: { ...initialState.solver, gameMode: 'visualizing' },
    }
    mockUseSudokuState.mockReturnValue(state)
    render(<UndoRedo />)
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled()
  })

  it('calls undo on click', async () => {
    const user = userEvent.setup()
    mockUseSudokuState.mockReturnValue({
      ...initialState,
      history: {
        index: 1,
        stack: [initialState.board, initialState.board],
      },
    })
    render(<UndoRedo />)

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(mockUndo).toHaveBeenCalled()
  })

  it('calls redo on click', async () => {
    const user = userEvent.setup()
    mockUseSudokuState.mockReturnValue({
      ...initialState,
      history: {
        index: 0,
        stack: [initialState.board, initialState.board],
      },
    })
    render(<UndoRedo />)

    await user.click(screen.getByRole('button', { name: 'Redo' }))
    expect(mockRedo).toHaveBeenCalled()
  })
})
