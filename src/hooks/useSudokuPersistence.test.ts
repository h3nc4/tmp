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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useSudokuPersistence } from './useSudokuPersistence'
import type { SudokuState } from '@/context/sudoku.types'
import { initialState } from '@/context/sudoku.reducer'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

describe('useSudokuPersistence', () => {
  let setItemSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    localStorageMock.clear()
    setItemSpy = vi.spyOn(localStorageMock, 'setItem')
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    setItemSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  it('should save the initial state to local storage on first render', () => {
    renderHook(() => useSudokuPersistence(initialState))
    expect(setItemSpy).toHaveBeenCalledOnce()
    expect(setItemSpy).toHaveBeenCalledWith(
      'wasudoku-game-state',
      expect.any(String),
    )
    const savedData = JSON.parse(setItemSpy.mock.calls[0][1] as string)
    expect(savedData.history.index).toBe(0)
    expect(savedData.history.stack).toHaveLength(1)
  })

  it('should save state to local storage when history changes', () => {
    const updatedState: SudokuState = {
      ...initialState,
      history: {
        stack: [...initialState.history.stack, initialState.board], // Simulate adding a new state
        index: 1,
      },
    }

    const { rerender } = renderHook((props) => useSudokuPersistence(props), {
      initialProps: initialState,
    })

    expect(setItemSpy).toHaveBeenCalledTimes(1)

    rerender(updatedState)

    expect(setItemSpy).toHaveBeenCalledTimes(2)
    const savedData = JSON.parse(setItemSpy.mock.calls[1][1] as string)
    expect(savedData.history.index).toBe(1)
    expect(savedData.history.stack).toHaveLength(2)
  })

  it('should not save state if only irrelevant props change', () => {
    const updatedState: SudokuState = {
      ...initialState,
      solver: { ...initialState.solver, isSolving: true }, // This prop change should not trigger a save
    }

    const { rerender } = renderHook((props) => useSudokuPersistence(props), {
      initialProps: initialState,
    })

    expect(setItemSpy).toHaveBeenCalledTimes(1)

    rerender(updatedState)

    // Should not have been called again
    expect(setItemSpy).toHaveBeenCalledTimes(1)
  })

  it('should handle local storage write errors gracefully', () => {
    setItemSpy.mockImplementation(() => {
      throw new Error('Storage is full')
    })

    renderHook(() => useSudokuPersistence(initialState))

    expect(setItemSpy).toThrow('Storage is full')
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to save game state to local storage:',
      expect.any(Error),
    )
  })
})
