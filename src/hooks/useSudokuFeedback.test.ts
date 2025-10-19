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

import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { toast } from 'sonner'
import { useSudokuFeedback } from './useSudokuFeedback'
import type { SudokuState } from '@/context/sudoku.types'
import { initialState } from '@/context/sudoku.reducer'

// --- Mocks ---
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}))

describe('useSudokuFeedback', () => {
  const mockDispatch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not show a toast or dispatch when there is no error', () => {
    const state: SudokuState = {
      ...initialState,
      ui: { ...initialState.ui, lastError: null },
    }
    renderHook(() => useSudokuFeedback(state, mockDispatch))
    expect(toast.error).not.toHaveBeenCalled()
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('shows a toast and dispatches clearError when an error is present', () => {
    const errorMessage = 'Invalid move'
    const state: SudokuState = {
      ...initialState,
      ui: { ...initialState.ui, lastError: errorMessage },
    }
    const { rerender } = renderHook(
      (props) => useSudokuFeedback(props.state, props.dispatch),
      { initialProps: { state, dispatch: mockDispatch } },
    )

    expect(toast.error).toHaveBeenCalledWith(errorMessage)
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'CLEAR_ERROR' })

    // Rerender with the error cleared to ensure the effect doesn't fire again
    const clearedState: SudokuState = {
      ...state,
      ui: { ...state.ui, lastError: null },
    }
    rerender({ state: clearedState, dispatch: mockDispatch })

    // The mocks should not be called a second time
    expect(toast.error).toHaveBeenCalledOnce()
    expect(mockDispatch).toHaveBeenCalledOnce()
  })
})
