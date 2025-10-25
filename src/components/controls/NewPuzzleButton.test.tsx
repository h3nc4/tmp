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
import userEvent from '@testing-library/user-event'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest'
import { NewPuzzleButton } from './NewPuzzleButton'
import { useSudokuState } from '@/context/sudoku.hooks'
import { useSudokuActions } from '@/hooks/useSudokuActions'
import { initialState } from '@/context/sudoku.reducer'
import type { SudokuState } from '@/context/sudoku.types'

vi.mock('@/context/sudoku.hooks')
vi.mock('@/hooks/useSudokuActions')

const mockUseSudokuState = useSudokuState as Mock
const mockUseSudokuActions = useSudokuActions as Mock

describe('NewPuzzleButton component', () => {
  const mockGeneratePuzzle = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSudokuState.mockReturnValue(initialState)
    mockUseSudokuActions.mockReturnValue({
      generatePuzzle: mockGeneratePuzzle,
    })
  })

  it('renders a dropdown button with difficulty options', async () => {
    const user = userEvent.setup()
    render(<NewPuzzleButton />)

    const triggerButton = screen.getByRole('button', { name: 'New Puzzle' })
    await user.click(triggerButton)

    expect(await screen.findByRole('menuitem', { name: 'Easy' })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Medium' })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Hard' })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Extreme' })).toBeVisible()
  })

  it('calls generatePuzzle with the correct difficulty on item click', async () => {
    const user = userEvent.setup()
    render(<NewPuzzleButton />)
    await user.click(screen.getByRole('button', { name: 'New Puzzle' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Hard' }))
    expect(mockGeneratePuzzle).toHaveBeenCalledWith('hard')
  })

  it('is disabled while solving', () => {
    mockUseSudokuState.mockReturnValue({
      ...initialState,
      solver: { ...initialState.solver, isSolving: true },
    })
    render(<NewPuzzleButton />)
    expect(screen.getByRole('button', { name: 'New Puzzle' })).toBeDisabled()
  })

  it('shows and hides "Generating..." state correctly based on isGenerating prop', () => {
    vi.useFakeTimers()
    const generatingState: SudokuState = {
      ...initialState,
      solver: { ...initialState.solver, isGenerating: true },
    }
    const { rerender } = render(<NewPuzzleButton />)
    mockUseSudokuState.mockReturnValue(generatingState)
    rerender(<NewPuzzleButton />)

    expect(screen.queryByText('Generating...')).not.toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(301)
    })
    expect(screen.getByText('Generating...')).toBeInTheDocument()

    mockUseSudokuState.mockReturnValue(initialState)
    rerender(<NewPuzzleButton />)

    expect(screen.queryByText('Generating...')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New Puzzle' })).toBeInTheDocument()
    vi.useRealTimers()
  })
})
