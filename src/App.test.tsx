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
import { useSudokuState } from './context/sudoku.hooks'
import { useSudokuActions } from './hooks/useSudokuActions'
import { initialState } from './context/sudoku.reducer'
import type { SudokuState } from './context/sudoku.types'

// --- Mocks ---
vi.mock('./context/sudoku.hooks')
vi.mock('./hooks/useSudokuActions')
// Mock the custom hook to prevent its implementation details from affecting this test
vi.mock('./hooks/useSynchronizedHeight', () => ({
  useSynchronizedHeight: vi.fn(() => ({
    sourceRef: vi.fn(),
    targetRef: vi.fn(),
  })),
}))

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
vi.mock('./components/SolverStepsPanel', () => ({
  SolverStepsPanel: vi.fn(() => <div data-testid="solver-steps-panel" />),
}))

const mockUseSudokuState = useSudokuState as Mock
const mockUseSudokuActions = useSudokuActions as Mock

describe('App component', () => {
  const mockEraseActiveCell = vi.fn()
  const defaultState: SudokuState = {
    ...initialState,
    ui: {
      ...initialState.ui,
      activeCellIndex: 5,
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSudokuState.mockReturnValue(defaultState)
    mockUseSudokuActions.mockReturnValue({
      eraseActiveCell: mockEraseActiveCell,
    })
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

  it('does not render the SolverStepsPanel in playing mode', () => {
    render(<App />)
    expect(screen.queryByTestId('solver-steps-panel')).not.toBeInTheDocument()
  })

  it('renders the SolverStepsPanel in visualizing mode', () => {
    mockUseSudokuState.mockReturnValue({
      ...defaultState,
      solver: {
        ...defaultState.solver,
        gameMode: 'visualizing',
      },
    })
    render(<App />)
    expect(screen.getByTestId('solver-steps-panel')).toBeInTheDocument()
  })

  it('calls eraseActiveCell when erase button is clicked', async () => {
    const user = userEvent.setup()
    render(<App />)

    const eraseButton = screen.getByRole('button', {
      name: 'Erase selected cell',
    })
    await user.click(eraseButton)
    expect(mockEraseActiveCell).toHaveBeenCalledWith('delete')
  })

  it('disables erase button when no cell is active', () => {
    mockUseSudokuState.mockReturnValue({
      ...initialState,
      ui: { ...initialState.ui, activeCellIndex: null },
    })
    render(<App />)
    expect(
      screen.getByRole('button', { name: 'Erase selected cell' }),
    ).toBeDisabled()
  })

  it('disables erase button when in visualizing mode', () => {
    mockUseSudokuState.mockReturnValue({
      ...defaultState,
      solver: { ...defaultState.solver, gameMode: 'visualizing' },
    })
    render(<App />)
    expect(
      screen.getByRole('button', { name: 'Erase selected cell' }),
    ).toBeDisabled()
  })
})
