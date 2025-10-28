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

import { render, renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { SudokuProvider } from './SudokuProvider'
import { useSudokuState, useSudokuDispatch } from './sudoku.hooks'
import { initialState } from './sudoku.reducer'

beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterAll(() => {
  vi.mocked(console.error).mockRestore()
})

const StateHookFailComponent = () => {
  useSudokuState()
  return null
}

const DispatchHookFailComponent = () => {
  useSudokuDispatch()
  return null
}

describe('Sudoku Context Hooks', () => {
  it('useSudokuState should throw an error when used outside of SudokuProvider', () => {
    expect(() => render(<StateHookFailComponent />)).toThrow(
      'useSudokuState must be used within a SudokuProvider',
    )
  })

  it('useSudokuDispatch should throw an error when used outside of SudokuProvider', () => {
    expect(() => render(<DispatchHookFailComponent />)).toThrow(
      'useSudokuDispatch must be used within a SudokuProvider',
    )
  })

  it('useSudokuState should return the state when used within a provider', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SudokuProvider>{children}</SudokuProvider>
    )
    const { result } = renderHook(() => useSudokuState(), { wrapper })
    expect(result.current).toEqual(initialState)
  })

  it('useSudokuDispatch should return the dispatch function when used within a provider', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SudokuProvider>{children}</SudokuProvider>
    )
    const { result } = renderHook(() => useSudokuDispatch(), { wrapper })
    expect(result.current).toBeInstanceOf(Function)
  })
})
