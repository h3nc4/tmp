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

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, type Mock, beforeEach } from 'vitest'
import { NumberPad } from './NumberPad'
import { useSudokuState } from '@/context/sudoku.hooks'
import { useSudokuActions } from '@/hooks/useSudokuActions'
import { initialState, createEmptyBoard } from '@/context/sudoku.reducer'
import type { SudokuState } from '@/context/sudoku.types'

vi.mock('@/context/sudoku.hooks')
vi.mock('@/hooks/useSudokuActions')

const mockUseSudokuState = useSudokuState as Mock
const mockUseSudokuActions = useSudokuActions as Mock

describe('NumberPad component', () => {
  const mockInputValue = vi.fn()
  const mockSetHighlightedValue = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSudokuState.mockReturnValue(initialState)
    mockUseSudokuActions.mockReturnValue({
      inputValue: mockInputValue,
      setHighlightedValue: mockSetHighlightedValue,
    })
  })

  it('renders 9 number buttons with their main number', () => {
    render(<NumberPad />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(9)

    for (let i = 1; i <= 9; i++) {
      const button = screen.getByRole('button', { name: `Enter number ${i}` })
      const mainNumber = within(button).getByText(String(i), {
        selector: 'span.text-lg',
      })
      expect(mainNumber).toBeInTheDocument()
      expect(mainNumber).toHaveClass('text-lg')
    }
  })

  it('calls inputValue and setHighlightedValue when a button is clicked', async () => {
    const user = userEvent.setup()
    render(<NumberPad />)

    const button5 = screen.getByRole('button', { name: 'Enter number 5' })
    await user.click(button5)

    expect(mockSetHighlightedValue).toHaveBeenCalledWith(5)
    expect(mockInputValue).toHaveBeenCalledWith(5)
  })

  it('disables a number button if that number is on the board 9 times', () => {
    const fullBoard = createEmptyBoard().map(() => ({
      ...initialState.board[0],
      value: 3,
    }))
    const state: SudokuState = { ...initialState, board: fullBoard }
    mockUseSudokuState.mockReturnValue(state)
    render(<NumberPad />)

    expect(screen.getByRole('button', { name: 'Enter number 3' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Enter number 4' })).not.toBeDisabled()
  })

  it('disables all number buttons when in visualizing mode', () => {
    const state: SudokuState = {
      ...initialState,
      solver: { ...initialState.solver, gameMode: 'visualizing' },
    }
    mockUseSudokuState.mockReturnValue(state)
    render(<NumberPad />)

    for (let i = 1; i <= 9; i++) {
      expect(screen.getByRole('button', { name: `Enter number ${i}` })).toBeDisabled()
    }
  })

  it('displays the remaining count for an incomplete number', () => {
    const partialBoard = createEmptyBoard().map((cell, i) => ({
      ...cell,
      value: i < 7 ? 3 : null,
    }))
    const state: SudokuState = { ...initialState, board: partialBoard }
    mockUseSudokuState.mockReturnValue(state)
    render(<NumberPad />)

    const button3 = screen.getByRole('button', { name: 'Enter number 3' })
    const count = within(button3).getByText('2')
    expect(count).toBeInTheDocument()
    expect(count).toHaveClass('text-muted-foreground')
  })

  it('does not display a count for a complete number', () => {
    const fullBoard = createEmptyBoard().map(() => ({
      ...initialState.board[0],
      value: 3,
    }))
    const state: SudokuState = { ...initialState, board: fullBoard }
    mockUseSudokuState.mockReturnValue(state)
    render(<NumberPad />)

    const button3 = screen.getByRole('button', { name: 'Enter number 3' })
    expect(button3).toBeDisabled()
    const counterSpan = button3.querySelector('span.absolute')
    expect(counterSpan).not.toBeInTheDocument()
  })
})
