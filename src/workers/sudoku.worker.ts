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
// It's initialized lazily on the first valid message.
let wasmReady: Promise<unknown> | null = null

// --- Core Logic ---

/**
 * Handles incoming messages, runs the solver, and posts the result back.
 * This function is exported for direct testing.
 * @param event The message event from the main thread.
 */
export async function handleMessage(
  event: MessageEvent<{ boardString: string }>,
) {
  // Ignore messages from untrusted origins.
  // The global `self` is available in a worker context.
  const isSameOrigin = self.location.origin === event.origin
  const isFileOrTestOrigin = event.origin === 'null' || event.origin === ''

  if (!isSameOrigin && !isFileOrTestOrigin) {
    console.error(`Message from untrusted origin '${event.origin}' ignored.`)
    return
  }

  try {
    // Lazily initialize the WASM module on the first valid message.
    wasmReady ??= init()
    await wasmReady

    const { boardString } = event.data
    const solution = solve_sudoku(boardString)

    // Post the successful solution back to the main thread.
    self.postMessage({ type: 'solution', solution })
  } catch (error) {
    // If the solver throws an error (e.g., invalid input, no solution, crash),
    // capture it and post it back to the main thread for graceful handling.
    const errorMessage = error instanceof Error ? error.message : String(error)
    self.postMessage({ type: 'error', error: errorMessage })
  }
}

// --- Event Listener ---

// Attach the handler to the 'message' event in the worker's global scope.
self.addEventListener('message', handleMessage)
