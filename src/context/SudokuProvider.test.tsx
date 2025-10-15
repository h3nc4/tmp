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
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { SudokuProvider } from './SudokuProvider'
import { useSudokuState, useSudokuDispatch } from './sudoku.hooks'
import { useSudokuPersistence } from '@/hooks/useSudokuPersistence'
import { useSudokuSolver } from '@/hooks/useSudokuSolver'
import { useSudokuFeedback } from '@/hooks/useSudokuFeedback'
import { initialState } from './sudoku.reducer'

// Mock the hooks that SudokuProvider calls as side effects
vi.mock('@/hooks/useSudokuPersistence')
vi.mock('@/hooks/useSudokuSolver')
vi.mock('@/hooks/useSudokuFeedback')

/** A simple test component that consumes the Sudoku context. */
const TestConsumer = () => {
  const state = useSudokuState()
  const dispatch = useSudokuDispatch()
  return (
    <div>
      <span data-testid="cell-0-value">{String(state.board[0].value)}</span>
      <button onClick={() => dispatch({ type: 'SET_ACTIVE_CELL', index: 5 })}>
        Dispatch
      </button>
    </div>
  )
}

describe('SudokuProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Ensure localStorage is clean before each test that relies on initialization
    vi.spyOn(window.localStorage.__proto__, 'getItem').mockReturnValue(null)
  })

  it('provides state and dispatch to children components', () => {
    render(
      <SudokuProvider>
        <TestConsumer />
      </SudokuProvider>,
    )
    // Check that state is accessible
    expect(screen.getByTestId('cell-0-value')).toHaveTextContent('null')
    // Check that dispatch is accessible (component renders a button with its onClick)
    expect(screen.getByRole('button', { name: 'Dispatch' })).toBeInTheDocument()
  })

  it('initializes with default state when localStorage is empty', () => {
    render(
      <SudokuProvider>
        <TestConsumer />
      </SudokuProvider>,
    )
    // Verify that the rendered state matches the default initial state
    expect(screen.getByTestId('cell-0-value')).toHaveTextContent(
      String(initialState.board[0].value),
    )
  })

  it('calls all side-effect hooks on render', () => {
    render(
      <SudokuProvider>
        <TestConsumer />
      </SudokuProvider>,
    )
    expect(useSudokuPersistence).toHaveBeenCalled()
    expect(useSudokuSolver).toHaveBeenCalled()
    expect(useSudokuFeedback).toHaveBeenCalled()
  })
})
