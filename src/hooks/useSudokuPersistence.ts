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

import { useEffect } from 'react'
import type { SavedGameState, SudokuState } from '@/context/sudoku.types'

const LOCAL_STORAGE_KEY = 'wasudoku-game-state'

/**
 * Custom JSON replacer to handle serializing `Set` objects.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function replacer(_key: string, value: any) {
  if (value instanceof Set) {
    return {
      __dataType: 'Set',
      value: [...value],
    }
  }
  return value
}

/**
 * Saves the game state to local storage.
 * @param state - The game state to save.
 */
function saveGameState(state: SavedGameState) {
  try {
    const stateJSON = JSON.stringify(state, replacer)
    window.localStorage.setItem(LOCAL_STORAGE_KEY, stateJSON)
  } catch (error) {
    console.error('Failed to save game state to local storage:', error)
  }
}

/**
 * A hook that listens to changes in the Sudoku state and persists them
 * to the browser's local storage.
 *
 * @param state - The current Sudoku state from the reducer.
 */
export function useSudokuPersistence(state: SudokuState) {
  useEffect(() => {
    saveGameState({
      history: state.history as SavedGameState['history'],
      historyIndex: state.historyIndex,
    })
  }, [state.history, state.historyIndex])
}
