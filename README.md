# WASudoku

WASudoku is a Sudoku solver that runs locally in your browser using WebAssembly.

## Features

### Core Engine

- **WASM Solver:** The solver logic is written in Rust and runs as a WebAssembly module in the background via a Web Worker, keeping the UI responsive.

### User Interface & Experience

- **Responsive UI:** The interface is built with Tailwind CSS and shadcn/ui for a clean and responsive layout. Also supports light and dark modes.
- **Keyboard Navigation:** Use arrow keys to navigate between cells, and Backspace/Delete to clear. Typing or deleting a number moves focus to the next/previous cell.
- **Number Pad:** An on-screen number pad allows users on mobile devices to input numbers easily.
- **Local Storage:** The game state, including the board and undo/redo history, is saved in local storage.

### Gameplay Features

- **Conflict Highlighting:** The board highlights numbers that break Sudoku rules in any row, column, or 3x3 box.
- **Undo/Redo:** Step backward and forward through any moves.
- **Multiple Input Modes:**
  - **Normal:** Enter the final numbers.
  - **Candidate:** Add small "corner" notes.
  - **Center:** Add "center" notes.

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
  - [wasm-bindgen](https://github.com/rustwasm/wasm-bindgen)
