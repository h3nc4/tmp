# WASudoku

WASudoku is a Sudoku solver that runs locally in your browser using WebAssembly.

## Features

### Core Engine

- **WASM Solver:** The solver logic is written in Rust and compiled to WebAssembly. It runs in a background Web Worker, ensuring the UI remains responsive during calculations.
- **Hybrid Solving Strategy:** The engine first uses logical, human-like techniques to find a solution path. If logic alone is insufficient, it seamlessly falls back to a backtracking algorithm.
- **Puzzle Generation:** Generates unique, solvable puzzles with a single solution for various difficulty levels (Easy, Medium, Hard, Extreme) directly in the browser.

### User Interface & Experience

- **Responsive & Modern UI:** Built with React, Vite, Tailwind CSS, and shadcn/ui for a clean, accessible, and responsive layout that works on any device.
- **Light & Dark Modes:** Supports both light and dark themes.
- **Installable (PWA):** As a Progressive Web App, WASudoku can be installed on your desktop or mobile device for a native, offline-first experience.
- **Local Storage Persistence:** Your current board state, including all numbers, pencil marks, and undo/redo history, is automatically saved to your browser's local storage.

### Gameplay Features

- **Solver Visualization:** After a puzzle is solved, the interface reveals all logical steps the solver took. Navigate step-by-step to see the board's state at each stage and understand the reasoning behind each move.
- **Conflict Highlighting:** The board highlights any numbers that break Sudoku rules in a row, column, or 3x3 box.
- **Undo/Redo:** Step backward and forward through any moves.
- **Multiple Input Modes:**
  - **Normal:** Enter the final numbers.
  - **Candidate:** Add small "corner" notes for potential numbers.
  - **Center:** Add "center" notes, used for advanced techniques.
- **Controls:**
  - **Navigation:** Use arrow keys to navigate between cells, and Backspace/Delete to clear. Typing a number automatically advances focus to the next cell.
  - **Number Pad:** An on-screen number pad makes input easy on touch devices and displays a count of remaining numbers to be placed.
  - **Clipboard Support:** Paste an 81-character puzzle string directly onto the grid to start solving.
  - **Export Puzzle:** Copy the current puzzle state as an 81-character string for sharing or saving.

## Architecture

The UI architecture follows the **Context + Reducer Pattern** with an emphasis on **State Domain Isolation**.

This is implemented using React's built-in [useReducer](https://react.dev/reference/react/useReducer) and [useContext](https://react.dev/reference/react/useContext) hooks.

## Stack

- **UI:**
  - [React](https://react.dev/)
  - [Vite](https://vitejs.dev/)
  - [TypeScript](https://www.typescriptlang.org/)
  - [Tailwind CSS](https://tailwindcss.com/)
  - [shadcn/ui](https://ui.shadcn.com/)
- **WebAssembly Module:**
  - [Rust](https://www.rust-lang.org/)
  - [wasm-pack](https://drager.github.io/wasm-pack/)
  - [wasm-bindgen](https://wasm-bindgen.github.io/wasm-bindgen/)
