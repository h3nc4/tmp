# WASudoku Development Guide for AI Agents

## Architecture Overview

**Hybrid React + Rust/WASM Application**: A Sudoku solver PWA with computational logic in Rust (compiled to WebAssembly) and UI in React.

### Core Architecture Pattern: Context + Reducer with Domain Isolation

The app uses React's `useReducer` + `useContext` for state management, **not** Redux or external state libraries.

- **State Container**: `SudokuProvider` (in `src/context/SudokuProvider.tsx`) wraps the app
- **Single Source of Truth**: `SudokuState` type (in `src/context/sudoku.types.ts`) defines all state
- **State Updates**: Pure reducer in `src/context/sudoku.reducer.ts` handles all state transitions
- **Action Creators**: `src/context/sudoku.actions.ts` provides typed action creators
- **Custom Hooks**: Side effects are isolated in hooks (`useSudokuSolver`, `useSudokuPersistence`, `useSudokuFeedback`) attached to the provider

### Data Flow: UI → Action → Reducer → State → Hooks (Side Effects)

1. UI components dispatch actions via `useSudokuDispatch()`
2. Reducer produces new immutable state
3. Hooks in `SudokuProvider` observe state changes and trigger side effects (Web Worker calls, localStorage, toasts)

**Critical**: State is immutable. The reducer uses spread operators and immutable updates. Never mutate `Set` objects directly—always create new instances.

## WASM Integration

### Build System

- **Development**: `npm run wasm:build:dev` - fast compilation with debug info
- **Production**: `npm run wasm:build:prod` - optimized for size (`opt-level = "s"`)
- **Auto-rebuild**: `predev` script ensures WASM builds before `vite dev`

### Web Worker Architecture

The Rust solver runs in a **Web Worker** (`src/workers/sudoku.worker.ts`) to prevent UI blocking:

1. Worker initializes WASM module on startup (`init()` from `wasudoku-wasm`)
2. Main thread posts `{ type: 'solve', boardString }` or `{ type: 'generate', difficulty }`
3. Worker calls Rust functions (`solve_sudoku`, `generate_sudoku`) and posts results back
4. `useSudokuSolver` hook manages worker lifecycle and dispatches success/failure actions

**Import alias**: `wasudoku-wasm` → `src/wasudoku-wasm/pkg` (see `vite.config.ts`)

### Rust Module Structure

- `src/wasudoku-wasm/src/lib.rs`: WASM exports (`solve_sudoku`, `generate_sudoku`)
- `src/wasudoku-wasm/src/board.rs`: Core `Board` struct with validation
- `src/wasudoku-wasm/src/logical_solver.rs`: Human-like solving techniques
- `src/wasudoku-wasm/src/solver.rs`: Backtracking algorithm (fallback)
- `src/wasudoku-wasm/src/generate.rs`: Puzzle generation by difficulty

**Hybrid Solving**: Logic-first, then backtracking if needed (see `solve_sudoku` in `lib.rs`)

## Testing

### Frontend Tests (Vitest + React Testing Library)

```bash
npm run test:ui  # Runs vitest with coverage
```

- **Pattern**: Co-located `*.test.tsx` files next to components
- **Setup**: `src/test/setup.ts` configures JSDOM and mocks (e.g., `ResizeObserver`)
- **Coverage**: Reports to `coverage-ui.lcov` (excludes `src/components/ui`, WASM, test files)

### Rust Tests

```bash
npm run test:rust  # Uses cargo-llvm-cov for coverage
```

- **Coverage tool**: `cargo llvm-cov` (installed via `scripts/wasm-deps.sh -d`)
- **Feature flag**: `test-panic` feature can induce panics for error-path testing
- **Output**: `coverage-wasm.xml` (Cobertura format)

### Combined Test Suite

```bash
npm test  # Runs both Rust and frontend tests, clears old coverage
```

## Development Workflows

### Initial Setup (Dev Container)

The project uses a Debian Trixie dev container (see `Dockerfile`):

- Rust 1.90.0 with `wasm32-unknown-unknown` target
- Node.js 22.20.0
- Tools installed via `scripts/wasm-deps.sh`

### Running Locally

```bash
npm run dev  # Auto-builds WASM, starts Vite dev server
```

### Making WASM Changes

1. Edit Rust code in `src/wasudoku-wasm/src/`
2. Run `npm run wasm:build:dev` (or restart `npm run dev`)
3. Reload browser to load new WASM module

**Note**: No hot-reload for WASM changes—manual rebuild required.

## Code Conventions

### File Headers

**Every** source file (`.ts`, `.tsx`, `.rs`) includes AGPL-3.0 copyright header:

```typescript
/*
 * Copyright (C) 2025  Henrique Almeida
 * This file is part of WASudoku.
 * ...full AGPL header...
 */
```

Use existing files as templates.

### Component Patterns

- **shadcn/ui components**: In `src/components/ui/` (auto-generated, minimal edits)
- **Custom components**: Use `@/` alias for imports (`@/components`, `@/hooks`, `@/lib`)
- **Styling**: Tailwind CSS with `cn()` utility from `@/lib/utils` for conditional classes
- **Theme**: `next-themes` for light/dark mode toggle

### State Access Pattern

```typescript
// In any component:
import { useSudokuState, useSudokuDispatch } from '@/context/sudoku.hooks'
import { useSudokuActions } from '@/hooks/useSudokuActions'

const { board, ui, solver, derived } = useSudokuState()
const dispatch = useSudokuDispatch()
const actions = useSudokuActions() // Convenience wrapper for action creators
```

### Immutable Updates

When updating state with `Set` objects:

```typescript
// ❌ WRONG (mutation)
cell.candidates.add(value)

// ✅ CORRECT (immutable)
{
  ...cell,
  candidates: new Set([...cell.candidates, value])
}
```

## Key Directories

- `src/context/`: State management (types, reducer, actions, hooks)
- `src/components/`: React components (UI + controls + domain components)
- `src/hooks/`: Custom hooks for side effects and reusable logic
- `src/workers/`: Web Worker for WASM solver
- `src/wasudoku-wasm/`: Rust solver crate (WASM target)
- `src/lib/`: Utilities (Sudoku validation, board helpers, Tailwind `cn()`)
- `scripts/`: Build scripts for dependencies, versioning, APK building

## Common Pitfalls

1. **WASM imports**: Always import from `wasudoku-wasm`, not relative paths to `pkg/`
2. **Worker context**: Web Worker code cannot access DOM or React context
3. **Readonly types**: TypeScript `readonly` modifiers are pervasive—respect them in updates
4. **Coverage exclusions**: Don't add logic to `src/components/ui/` (shadcn/ui files)
5. **Dependency installation**: WASM tools via `scripts/wasm-deps.sh`, not npm
