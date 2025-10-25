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

/* v8 ignore next */
import init, { solve_sudoku, generate_sudoku } from 'wasudoku-wasm'

// Initialize the WASM module on worker startup.
const wasmReady = init()

type WorkerMessage =
  | { type: 'solve'; boardString: string }
  | { type: 'generate'; difficulty: string }

/**
 * Handles incoming messages, runs the solver, and posts the result back.
 * Exported for direct testing.
 * @param event The message event from the main thread.
 */
export async function handleMessage(event: MessageEvent<WorkerMessage>) {
  // Enforce same-origin policy for security. `self` is the worker's global scope.
  const isSameOrigin = self.location.origin === event.origin
  const isFileOrTestOrigin = event.origin === 'null' || event.origin === ''

  if (!isSameOrigin && !isFileOrTestOrigin) {
    console.error(`Message from untrusted origin '${event.origin}' ignored.`)
    return
  }

  try {
    await wasmReady
    const { type } = event.data

    if (type === 'solve') {
      const result = solve_sudoku(event.data.boardString)
      self.postMessage({ type: 'solution', result })
    } else if (type === 'generate') {
      const puzzleString = generate_sudoku(event.data.difficulty)
      self.postMessage({ type: 'puzzle_generated', puzzleString })
    }
  } catch (error) {
    // Capture any solver error and post it back for graceful handling in the UI.
    const errorMessage = error instanceof Error ? error.message : String(error)
    self.postMessage({ type: 'error', error: errorMessage })
  }
}

// Attach the handler to the 'message' event in the worker's global scope.
self.addEventListener('message', handleMessage)
