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

import { render, screen, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import userEvent from '@testing-library/user-event'
import App from './App'
import { useSudoku } from './hooks/useSudoku'
import { ModeToggle } from './components/mode-toggle'

// --- Mocks ---

// Mock child components to prevent their complex logic from affecting App tests
vi.mock('./components/SudokuGrid', () => ({
  SudokuGrid: vi.fn(
    ({ onCellFocus, onCellChange, activeCellIndex, inputMode }) => (
      <div data-testid="sudoku-grid">
        <input
          aria-label="mock-cell-0"
          onFocus={() => onCellFocus(0)}
          onChange={(e) => {
            const value = e.target.value ? parseInt(e.target.value) : null
            onCellChange(0, value)
          }}
        />
        <p>Active Cell: {String(activeCellIndex)}</p>
        <p>Input Mode: {inputMode}</p>
      </div>
    ),
  ),
}))

vi.mock('./components/mode-toggle', () => ({
  ModeToggle: vi.fn(() => (
    <button aria-label="Toggle Theme">Theme Toggle</button>
  )),
}))

// Mock the main hook
vi.mock('./hooks/useSudoku', () => ({
  useSudoku: vi.fn(),
}))

const mockUseSudoku = useSudoku as Mock

// --- Tests ---

describe('App component', () => {
  const mockSetInputMode = vi.fn()
  const mockSetActiveCellIndex = vi.fn()
  const mockSetCellValue = vi.fn()
  const mockTogglePencilMark = vi.fn()
  const mockEraseCell = vi.fn()
  const mockClearBoard = vi.fn()
  const mockSolve = vi.fn()
  const mockUndo = vi.fn()
  const mockRedo = vi.fn()

  const defaultHookValues = {
    board: [],
    initialBoard: [],
    isSolving: false,
    isSolved: false,
    conflicts: new Set(),
    activeCellIndex: null,
    inputMode: 'normal',
    isSolveDisabled: true,
    isClearDisabled: true,
    solveButtonTitle: 'Board is empty.',
    clearButtonTitle: 'Board is already empty.',
    canUndo: false,
    canRedo: false,
    setInputMode: mockSetInputMode,
    setActiveCellIndex: mockSetActiveCellIndex,
    setCellValue: mockSetCellValue,
    togglePencilMark: mockTogglePencilMark,
    eraseCell: mockEraseCell,
    clearBoard: mockClearBoard,
    solve: mockSolve,
    undo: mockUndo,
    redo: mockRedo,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSudoku.mockReturnValue(defaultHookValues)
  })

  it('renders the main layout correctly', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: /wasudoku/i }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('sudoku-grid')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /github repository/i }),
    ).toHaveAttribute('href', 'https://github.com/h3nc4/WASudoku')
    expect(ModeToggle).toHaveBeenCalled()
    expect(
      screen.getByRole('link', { name: /henrique almeida/i }),
    ).toHaveAttribute('href', 'https://h3nc4.com')
  })

  it('handles grid interactions: focus and cell change', async () => {
    const user = userEvent.setup()
    render(<App />)
    const mockCell = screen.getByLabelText('mock-cell-0')

    // Test focusing
    await user.click(mockCell)
    expect(mockSetActiveCellIndex).toHaveBeenCalledWith(0)

    // Test cell change in normal mode
    await user.type(mockCell, '5')
    expect(mockSetCellValue).toHaveBeenCalledWith(0, 5)

    // Test clearing cell
    await user.clear(mockCell)
    expect(mockEraseCell).toHaveBeenCalledWith(0)
  })

  it('handles cell change in candidate mode', async () => {
    const user = userEvent.setup()
    mockUseSudoku.mockReturnValue({
      ...defaultHookValues,
      inputMode: 'candidate',
    })
    render(<App />)
    const mockCell = screen.getByLabelText('mock-cell-0')

    await user.type(mockCell, '3')
    expect(mockTogglePencilMark).toHaveBeenCalledWith(0, 3, 'candidate')
  })

  it('handles cell change in center mode', async () => {
    const user = userEvent.setup()
    mockUseSudoku.mockReturnValue({
      ...defaultHookValues,
      inputMode: 'center',
    })
    render(<App />)
    const mockCell = screen.getByLabelText('mock-cell-0')

    await user.type(mockCell, '8')
    expect(mockTogglePencilMark).toHaveBeenCalledWith(0, 8, 'center')
  })

  it('changes input mode when toggle group is clicked', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('radio', { name: 'Candidate' }))
    expect(mockSetInputMode).toHaveBeenCalledWith('candidate')
  })

  it('calls eraseCell when erase button is clicked and a cell is active', async () => {
    const user = userEvent.setup()
    mockUseSudoku.mockReturnValue({ ...defaultHookValues, activeCellIndex: 0 })
    render(<App />)

    const eraseButton = screen.getByRole('button', {
      name: 'Erase selected cell',
    })
    await user.click(eraseButton)
    expect(mockEraseCell).toHaveBeenCalledWith(0)
  })

  it('disables erase button when no cell is active', () => {
    render(<App />)
    expect(
      screen.getByRole('button', { name: 'Erase selected cell' }),
    ).toBeDisabled()
  })

  it('calls undo and redo functions when buttons are clicked', async () => {
    const user = userEvent.setup()
    mockUseSudoku.mockReturnValue({
      ...defaultHookValues,
      canUndo: true,
      canRedo: true,
    })
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(mockUndo).toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Redo' }))
    expect(mockRedo).toHaveBeenCalled()
  })

  it('calls solve and clear functions when buttons are clicked', async () => {
    const user = userEvent.setup()
    mockUseSudoku.mockReturnValue({
      ...defaultHookValues,
      isSolveDisabled: false,
      isClearDisabled: false,
    })
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Solve Puzzle' }))
    expect(mockSolve).toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Clear Board' }))
    expect(mockClearBoard).toHaveBeenCalled()
  })

  it('shows "Solving..." state after a delay', () => {
    vi.useFakeTimers()
    mockUseSudoku.mockReturnValue({ ...defaultHookValues, isSolving: true })
    render(<App />)

    expect(screen.queryByText('Solving...')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Solve Puzzle' }),
    ).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(screen.getByText('Solving...')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /solving/i }),
    ).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('clears solving state immediately if solving finishes before delay', () => {
    vi.useFakeTimers()
    mockUseSudoku.mockReturnValue({ ...defaultHookValues, isSolving: true })
    const { rerender } = render(<App />)

    act(() => {
      vi.advanceTimersByTime(300)
    })

    mockUseSudoku.mockReturnValue({ ...defaultHookValues, isSolving: false })
    rerender(<App />)

    act(() => {
      vi.runAllTimers()
    })

    expect(screen.queryByText('Solving...')).not.toBeInTheDocument()
    vi.useRealTimers()
  })
})
