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
import App from './App'
import {
  useSudokuState,
  useSudokuDispatch,
} from './context/sudoku.hooks'
import { initialState } from './context/sudoku.reducer'

// --- Mocks ---
vi.mock('./context/sudoku.hooks')

// Mock child components
vi.mock('./components/SudokuGrid', () => ({
  SudokuGrid: vi.fn(() => <div data-testid="sudoku-grid" />),
}))
vi.mock('./components/NumberPad', () => ({
  NumberPad: vi.fn(() => <button>NumberPad</button>),
}))
vi.mock('./components/controls/SolveButton', () => ({
  SolveButton: vi.fn(() => <button>Solve</button>),
}))
vi.mock('./components/controls/ClearButton', () => ({
  ClearButton: vi.fn(() => <button>Clear</button>),
}))
vi.mock('./components/controls/UndoRedo', () => ({
  UndoRedo: vi.fn(() => (
    <>
      <button>Undo</button>
      <button>Redo</button>
    </>
  )),
}))
vi.mock('./components/controls/InputModeToggle', () => ({
  InputModeToggle: vi.fn(() => <button>Toggle Mode</button>),
}))
vi.mock('./components/mode-toggle', () => ({
  ModeToggle: vi.fn(() => <button>Toggle Theme</button>),
}))

const mockUseSudokuState = useSudokuState as Mock
const mockUseSudokuDispatch = useSudokuDispatch as Mock

describe('App component', () => {
  const mockDispatch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSudokuState.mockReturnValue(initialState)
    mockUseSudokuDispatch.mockReturnValue(mockDispatch)
  })

  it('renders the main layout and all control components', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: /wasudoku/i }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('sudoku-grid')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'NumberPad' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Solve' })).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /github repository/i }),
    ).toBeInTheDocument()
  })

  it('calls dispatch with eraseActiveCell when erase button is clicked and a cell is active', async () => {
    const user = userEvent.setup()
    mockUseSudokuState.mockReturnValue({ ...initialState, activeCellIndex: 5 })
    render(<App />)

    const eraseButton = screen.getByRole('button', {
      name: 'Erase selected cell',
    })
    await user.click(eraseButton)
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'ERASE_ACTIVE_CELL',
      mode: 'delete',
    })
  })

  it('does not dispatch when erase button is clicked and no cell is active', async () => {
    const user = userEvent.setup()
    mockUseSudokuState.mockReturnValue({ ...initialState, activeCellIndex: null })
    render(<App />)

    const eraseButton = screen.getByRole('button', {
      name: 'Erase selected cell',
    })
    await user.click(eraseButton)
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('disables erase button when no cell is active', () => {
    mockUseSudokuState.mockReturnValue({ ...initialState, activeCellIndex: null })
    render(<App />)
    expect(
      screen.getByRole('button', { name: 'Erase selected cell' }),
    ).toBeDisabled()
  })
})
