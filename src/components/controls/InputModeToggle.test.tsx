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
import { InputModeToggle } from './InputModeToggle'
import { useSudokuState } from '@/context/sudoku.hooks'
import { useSudokuActions } from '@/hooks/useSudokuActions'
import { initialState } from '@/context/sudoku.reducer'

vi.mock('@/context/sudoku.hooks')
vi.mock('@/hooks/useSudokuActions')

const mockUseSudokuState = useSudokuState as Mock
const mockUseSudokuActions = useSudokuActions as Mock

describe('InputModeToggle component', () => {
  const mockSetInputMode = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSudokuState.mockReturnValue(initialState) // default mode is 'normal'
    mockUseSudokuActions.mockReturnValue({ setInputMode: mockSetInputMode })
  })

  it('renders with the correct initial mode selected', () => {
    render(<InputModeToggle />)
    const normalButton = screen.getByRole('radio', { name: 'Normal' })
    expect(normalButton).toBeChecked()
  })

  it('calls setInputMode when a different mode is selected', async () => {
    const user = userEvent.setup()
    render(<InputModeToggle />)

    const candidateButton = screen.getByRole('radio', { name: 'Candidate' })
    await user.click(candidateButton)

    expect(mockSetInputMode).toHaveBeenCalledWith('candidate')
  })

  it('does not call setInputMode if the onValueChange callback receives an empty value', async () => {
    const user = userEvent.setup()
    // Start with a mode selected
    mockUseSudokuState.mockReturnValue({
      ...initialState,
      ui: { ...initialState.ui, inputMode: 'candidate' },
    })
    render(<InputModeToggle />)

    const candidateButton = screen.getByRole('radio', { name: 'Candidate' })
    await user.click(candidateButton)

    expect(mockSetInputMode).not.toHaveBeenCalled()
  })

  it('is disabled when in visualizing mode', () => {
    mockUseSudokuState.mockReturnValue({
      ...initialState,
      solver: { ...initialState.solver, gameMode: 'visualizing' },
    })
    render(<InputModeToggle />)

    // Check that the individual buttons inside the group are disabled.
    screen.getAllByRole('radio').forEach((button) => {
      expect(button).toBeDisabled()
    })
  })
})
