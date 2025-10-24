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

import type {
  SudokuAction,
  SetCellValueAction,
  TogglePencilMarkAction,
  EraseCellAction,
  SolveSuccessAction,
  ViewSolverStepAction,
  SetActiveCellAction,
  ImportBoardAction,
} from './sudoku.actions.types'
import type {
  BoardState,
  SudokuState,
  SavedGameState,
  HistoryState,
} from './sudoku.types'
import {
  getRelatedCellIndices,
  validateBoard,
  calculateCandidates,
  boardStateFromString,
} from '@/lib/utils'

const BOARD_SIZE = 81
const LOCAL_STORAGE_KEY = 'wasudoku-game-state'
const MAX_HISTORY_ENTRIES = 100

export const createEmptyBoard = (): BoardState =>
  Array(BOARD_SIZE)
    .fill(null)
    .map(() => ({
      value: null,
      candidates: new Set<number>(),
      centers: new Set<number>(),
    }))

function getDerivedBoardState(board: BoardState) {
  const conflicts = validateBoard(board)
  const hasValues = board.some((cell) => cell.value !== null)
  const isBoardFull = board.every((cell) => cell.value !== null)

  return {
    conflicts,
    isBoardEmpty: !hasValues,
    isBoardFull,
  }
}

export const initialState: SudokuState = {
  board: createEmptyBoard(),
  initialBoard: createEmptyBoard(),
  history: {
    stack: [createEmptyBoard()],
    index: 0,
  },
  ui: {
    activeCellIndex: null,
    highlightedValue: null,
    inputMode: 'normal',
    lastError: null,
  },
  solver: {
    isSolving: false,
    isSolved: false,
    solveFailed: false,
    gameMode: 'playing',
    steps: [],
    currentStepIndex: null,
    visualizationBoard: null,
    candidatesForViz: null,
    eliminationsForViz: null,
  },
  derived: getDerivedBoardState(createEmptyBoard()),
}

/**
 * Custom JSON reviver to handle deserializing `Set` objects.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function reviver(_key: string, value: any) {
  if (
    typeof value === 'object' &&
    value !== null &&
    value.__dataType === 'Set' &&
    Array.isArray(value.value)
  ) {
    return new Set(value.value)
  }
  return value
}

export function loadInitialState(): SudokuState {
  try {
    const savedStateJSON = window.localStorage.getItem(LOCAL_STORAGE_KEY)
    if (savedStateJSON) {
      const savedState = JSON.parse(savedStateJSON, reviver) as SavedGameState
      if (
        savedState?.history &&
        Array.isArray(savedState.history.stack) &&
        typeof savedState.history.index === 'number' &&
        savedState.history.stack.length > 0
      ) {
        const currentBoard = savedState.history.stack[savedState.history.index]
        return {
          ...initialState,
          history: savedState.history,
          board: currentBoard,
          initialBoard: currentBoard.map(cell => ({ value: cell.value, candidates: new Set<number>(), centers: new Set<number>() })),
          derived: getDerivedBoardState(currentBoard),
        }
      }
    }
  } catch (error) {
    console.error('Failed to load game state from local storage:', error)
  }
  return initialState
}

function updateHistory(
  historyState: HistoryState,
  newBoard: BoardState,
): HistoryState {
  let newStack = historyState.stack.slice(0, historyState.index + 1)
  newStack.push(newBoard)

  if (newStack.length > MAX_HISTORY_ENTRIES) {
    newStack = newStack.slice(newStack.length - MAX_HISTORY_ENTRIES)
  }

  return {
    stack: newStack,
    index: newStack.length - 1,
  }
}

const handleSetCellValue = (
  state: SudokuState,
  action: SetCellValueAction,
): SudokuState => {
  if (state.board[action.index].value === action.value) return state

  const newBoard = state.board.map((cell) => ({
    value: cell.value,
    candidates: new Set(cell.candidates),
    centers: new Set(cell.centers),
  }))

  newBoard[action.index] = {
    value: action.value,
    candidates: new Set<number>(),
    centers: new Set<number>(),
  }

  getRelatedCellIndices(action.index).forEach((relatedIndex) => {
    newBoard[relatedIndex].candidates.delete(action.value)
    newBoard[relatedIndex].centers.delete(action.value)
  })

  return {
    ...state,
    board: newBoard,
    history: updateHistory(state.history, newBoard),
    solver: { ...state.solver, isSolved: false, solveFailed: false },
  }
}

const handleTogglePencilMark = (
  state: SudokuState,
  action: TogglePencilMarkAction,
): SudokuState => {
  if (state.board[action.index].value !== null) return state

  const newBoard = state.board.map((c) => ({
    value: c.value,
    candidates: new Set(c.candidates),
    centers: new Set(c.centers),
  }))
  const targetCell = newBoard[action.index]

  if (action.mode === 'candidate') {
    targetCell.candidates.has(action.value)
      ? targetCell.candidates.delete(action.value)
      : targetCell.candidates.add(action.value)
  } else {
    targetCell.candidates.clear()
    targetCell.centers.has(action.value)
      ? targetCell.centers.delete(action.value)
      : targetCell.centers.add(action.value)
  }

  return {
    ...state,
    board: newBoard,
    history: updateHistory(state.history, newBoard),
    solver: { ...state.solver, solveFailed: false },
  }
}

const handleEraseCell = (
  state: SudokuState,
  action: EraseCellAction,
): SudokuState => {
  const cell = state.board[action.index]
  if (
    cell.value === null &&
    cell.candidates.size === 0 &&
    cell.centers.size === 0
  ) {
    return state
  }

  const newBoard = state.board.map((cell, i) =>
    i === action.index
      ? { value: null, candidates: new Set<number>(), centers: new Set<number>() }
      : {
        value: cell.value,
        candidates: new Set(cell.candidates),
        centers: new Set(cell.centers),
      },
  )

  return {
    ...state,
    board: newBoard,
    history: updateHistory(state.history, newBoard),
    solver: { ...state.solver, isSolved: false, solveFailed: false },
  }
}

const handleClearBoard = (state: SudokuState): SudokuState => {
  if (state.derived.isBoardEmpty) return state

  const newBoard = createEmptyBoard()
  return {
    ...initialState,
    board: newBoard,
    history: updateHistory(state.history, newBoard),
  }
}

const handleImportBoard = (
  _state: SudokuState,
  action: ImportBoardAction,
): SudokuState => {
  const newBoard = boardStateFromString(action.boardString)
  return {
    ...initialState,
    board: newBoard,
    initialBoard: newBoard,
    history: {
      stack: [newBoard],
      index: 0,
    },
  }
}

const handleUndo = (state: SudokuState): SudokuState => {
  if (state.history.index > 0) {
    const newHistoryIndex = state.history.index - 1
    return {
      ...state,
      history: { ...state.history, index: newHistoryIndex },
      board: state.history.stack[newHistoryIndex],
      solver: { ...state.solver, isSolved: false, solveFailed: false },
    }
  }
  return state
}

const handleRedo = (state: SudokuState): SudokuState => {
  if (state.history.index < state.history.stack.length - 1) {
    const newHistoryIndex = state.history.index + 1
    return {
      ...state,
      history: { ...state.history, index: newHistoryIndex },
      board: state.history.stack[newHistoryIndex],
    }
  }
  return state
}

const handleSolveSuccess = (
  state: SudokuState,
  action: SolveSuccessAction,
): SudokuState => {
  const { steps, solution } = action.result
  if (!solution) {
    return {
      ...state,
      solver: { ...state.solver, isSolving: false, solveFailed: true },
    }
  }
  const solvedBoard: BoardState = solution
    .split('')
    .map((char) => ({
      value: char === '.' ? null : parseInt(char, 10),
      candidates: new Set<number>(),
      centers: new Set<number>(),
    }))

  const boardAfterLogic = state.initialBoard.map((cell) => ({ ...cell }))
  steps.forEach((step) =>
    step.placements.forEach(
      (p) => (boardAfterLogic[p.index].value = p.value),
    ),
  )

  const finalSteps = [...steps]
  if (!boardAfterLogic.every((cell) => cell.value !== null)) {
    finalSteps.push({
      technique: 'Backtracking',
      placements: [],
      eliminations: [],
      cause: [],
    })
  }

  return {
    ...state,
    board: solvedBoard,
    solver: {
      ...state.solver,
      isSolving: false,
      isSolved: true,
      gameMode: 'visualizing',
      steps: finalSteps,
      currentStepIndex: finalSteps.length,
      visualizationBoard: solvedBoard,
    },
  }
}

const handleViewSolverStep = (
  state: SudokuState,
  action: ViewSolverStepAction,
): SudokuState => {
  if (state.solver.gameMode !== 'visualizing') return state

  let boardForStep = state.initialBoard.map((c) => ({ ...c, candidates: new Set<number>(), centers: new Set<number>() }));
  if (action.index === state.solver.steps.length) {
    boardForStep = state.board.map((c) => ({ ...c, candidates: new Set<number>(), centers: new Set<number>() }));
  } else {
    for (let i = 0; i < action.index; i++) {
      for (const p of state.solver.steps[i].placements) {
        boardForStep[p.index].value = p.value;
      }
    }
  }

  const boardBeforeCurrentStep = state.initialBoard.map((c) => ({ ...c, candidates: new Set<number>(), centers: new Set<number>() }));
  for (let i = 0; i < action.index - 1; i++) {
    for (const p of state.solver.steps[i].placements) {
      boardBeforeCurrentStep[p.index].value = p.value;
    }
  }

  const candidates = calculateCandidates(boardBeforeCurrentStep);

  for (let i = 0; i < action.index - 1; i++) {
    for (const elim of state.solver.steps[i].eliminations) {
      candidates[elim.index]?.delete(elim.value);
    }
  }

  const elims =
    action.index > 0 ? state.solver.steps[action.index - 1].eliminations : [];

  return {
    ...state,
    solver: {
      ...state.solver,
      currentStepIndex: action.index,
      visualizationBoard: boardForStep,
      candidatesForViz: candidates,
      eliminationsForViz: elims,
    },
  };
};

const handleExitVisualization = (state: SudokuState): SudokuState => ({
  ...state,
  board: state.initialBoard,
  solver: { ...initialState.solver },
})

const handleSetActiveCell = (
  state: SudokuState,
  action: SetActiveCellAction,
): SudokuState => ({
  ...state,
  ui: {
    ...state.ui,
    activeCellIndex: action.index,
    highlightedValue:
      action.index !== null ? state.board[action.index].value : null,
    lastError: null,
  },
})

export function sudokuReducer(
  state: SudokuState,
  action: SudokuAction,
): SudokuState {
  let newState: SudokuState

  switch (action.type) {
    case 'SET_CELL_VALUE':
      newState = handleSetCellValue(state, action)
      break
    case 'TOGGLE_PENCIL_MARK':
      newState = handleTogglePencilMark(state, action)
      break
    case 'ERASE_CELL':
      newState = handleEraseCell(state, action)
      break
    case 'CLEAR_BOARD':
      newState = handleClearBoard(state)
      break
    case 'IMPORT_BOARD':
      newState = handleImportBoard(state, action)
      break
    case 'UNDO':
      newState = handleUndo(state)
      break
    case 'REDO':
      newState = handleRedo(state)
      break
    case 'SOLVE_START':
      newState = {
        ...state,
        initialBoard: state.board,
        solver: { ...state.solver, isSolving: true },
      }
      break
    case 'SOLVE_SUCCESS':
      newState = handleSolveSuccess(state, action)
      break
    case 'SOLVE_FAILURE':
      newState = {
        ...state,
        solver: { ...state.solver, isSolving: false, solveFailed: true },
      }
      break
    case 'VIEW_SOLVER_STEP':
      newState = handleViewSolverStep(state, action)
      break
    case 'EXIT_VISUALIZATION':
      newState = handleExitVisualization(state)
      break
    case 'SET_ACTIVE_CELL':
      newState = handleSetActiveCell(state, action)
      break
    case 'SET_INPUT_MODE':
      newState = { ...state, ui: { ...state.ui, inputMode: action.mode } }
      break
    case 'CLEAR_ERROR':
      newState = { ...state, ui: { ...state.ui, lastError: null } }
      break
    case 'SET_HIGHLIGHTED_VALUE':
      newState = { ...state, ui: { ...state.ui, highlightedValue: action.value } }
      break
    default:
      newState = state
  }

  if (newState.board !== state.board) {
    return {
      ...newState,
      derived: getDerivedBoardState(newState.board),
    }
  }

  return newState
}
