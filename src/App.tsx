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

import { useEffect, useState, useCallback } from 'react';
import init, { greet } from 'wasudoku-wasm';

function App() {
  const [wasmLoaded, setWasmLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Initializes the WebAssembly module when the component mounts.
   */
  useEffect(() => {
    const loadWasm = async () => {
      try {
        // Initialize the WASM module
        await init();
        setWasmLoaded(true);
        console.log("WebAssembly module loaded successfully.");
      } catch (e) {
        console.error("Failed to load WebAssembly module:", e);
        setError("Failed to load WASM module.");
      }
    };

    loadWasm();
  }, []);

  /**
   * Calls the `greet` function from the WASM module.
   * This is wrapped in useCallback for potential future optimizations or dependencies.
   */
  const handleGreet = useCallback(() => {
    if (wasmLoaded) {
      greet();
    } else {
      alert("WASM module not loaded yet.");
    }
  }, [wasmLoaded]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4">
      <h1 className="text-4xl font-bold mb-8">WASudoku</h1>
      {error && <p className="text-destructive mb-4">{error}</p>}
      <button
        onClick={handleGreet}
        className="px-6 py-3 bg-primary text-primary-foreground rounded-lg shadow-md hover:bg-primary/90 transition-colors duration-200"
        disabled={!wasmLoaded}
      >
        {wasmLoaded ? "Click me 😎" : "Loading WASM..."}
      </button>
    </div>
  );
}

export default App;
