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

import init, { solve_sudoku } from 'wasudoku-wasm'

// --- Worker State ---

// A promise that resolves when the WASM module is initialized.
// This ensures we only initialize the module once.
const wasmReady = init()

// --- Event Listener ---

/**
 * Listens for messages from the main thread containing a Sudoku board string.
 * When a message is received, it runs the solver and posts the result back.
 */
self.addEventListener(
  'message',
  async (event: MessageEvent<{ boardString: string }>) => {
    try {
      // Ensure the WASM module is loaded and ready before proceeding.
      await wasmReady

      const { boardString } = event.data
      const solution = solve_sudoku(boardString)

      // Post the successful solution back to the main thread.
      self.postMessage({ type: 'solution', solution })
    } catch (error) {
      // If the solver throws an error (e.g., invalid input, no solution, crash),
      // capture it and post it back to the main thread for graceful handling.
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      self.postMessage({ type: 'error', error: errorMessage })
    }
  },
)
