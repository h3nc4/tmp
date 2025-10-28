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
import { ClearButton } from './ClearButton'
import { useSudokuState } from '@/context/sudoku.hooks'
import { useSudokuActions } from '@/hooks/useSudokuActions'
import { initialState } from '@/context/sudoku.reducer'
import { toast } from 'sonner'

vi.mock('@/context/sudoku.hooks')
vi.mock('@/hooks/useSudokuActions')
vi.mock('sonner', () => ({ toast: { info: vi.fn() } }))

const mockUseSudokuState = useSudokuState as Mock
const mockUseSudokuActions = useSudokuActions as Mock

describe('ClearButton component', () => {
  const mockClearBoard = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSudokuState.mockReturnValue({
      ...initialState,
      derived: { ...initialState.derived, isBoardEmpty: true },
    })
    mockUseSudokuActions.mockReturnValue({ clearBoard: mockClearBoard })
  })

  it('is disabled and has correct title when board is empty', () => {
    render(<ClearButton />)
    const button = screen.getByRole('button', { name: 'Clear Board' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', 'Board is already empty.')
  })

  it('is enabled when board is not empty', () => {
    mockUseSudokuState.mockReturnValue({
      ...initialState,
      derived: { ...initialState.derived, isBoardEmpty: false },
    })
    render(<ClearButton />)
    expect(screen.getByRole('button', { name: 'Clear Board' })).not.toBeDisabled()
  })

  it('calls clearBoard and shows toast on click', async () => {
    const user = userEvent.setup()
    mockUseSudokuState.mockReturnValue({
      ...initialState,
      derived: { ...initialState.derived, isBoardEmpty: false },
    })
    render(<ClearButton />)

    await user.click(screen.getByRole('button', { name: 'Clear Board' }))
    expect(mockClearBoard).toHaveBeenCalled()
    expect(toast.info).toHaveBeenCalledWith('Board cleared.')
  })

  it('is disabled while solving', () => {
    mockUseSudokuState.mockReturnValue({
      ...initialState,
      derived: { ...initialState.derived, isBoardEmpty: false },
      solver: { ...initialState.solver, isSolving: true },
    })
    render(<ClearButton />)
    expect(screen.getByRole('button', { name: 'Clear Board' })).toBeDisabled()
  })
})
