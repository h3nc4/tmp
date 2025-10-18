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

import React, {
  useMemo,
  useEffect,
  useCallback,
  createRef,
} from 'react'
import SudokuCell from './SudokuCell'
import { getRelatedCellIndices } from '@/lib/utils'
import { useSudokuState } from '@/context/sudoku.hooks'
import { useSudokuActions } from '@/hooks/useSudokuActions'
import type { CellState } from '@/context/sudoku.types'

interface SudokuGridProps { }

/**
 * Renders the 9x9 Sudoku grid container and manages all keyboard interactions.
 * It orchestrates focus management and dispatches actions for cell changes.
 */
export function SudokuGrid({ }: SudokuGridProps) {
  const {
    board,
    initialBoard,
    isSolving,
    isSolved,
    activeCellIndex,
    highlightedValue,
    conflicts,
    gameMode,
    visualizationBoard,
    candidatesForViz,
    eliminationsForViz,
  } = useSudokuState()
  const actions = useSudokuActions()

  const displayBoard = gameMode === 'visualizing' ? visualizationBoard : board
  const isReadOnly = gameMode === 'visualizing' || isSolving

  const cellRefs = useMemo(
    () => Array.from({ length: 81 }, () => createRef<HTMLInputElement>()),
    [],
  )

  const highlightedIndices = useMemo(() => {
    if (activeCellIndex === null) {
      return new Set<number>()
    }
    return getRelatedCellIndices(activeCellIndex)
  }, [activeCellIndex])

  // Effect to declaratively manage focus based on the activeCellIndex state.
  useEffect(() => {
    if (activeCellIndex !== null && cellRefs[activeCellIndex]?.current) {
      cellRefs[activeCellIndex].current?.focus()
    }
  }, [activeCellIndex, cellRefs])

  const handleCellFocus = useCallback(
    (index: number) => {
      if (!isReadOnly) {
        actions.setActiveCell(index)
      }
    },
    [actions, isReadOnly],
  )

  // Centralized keyboard handler for the entire grid.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isReadOnly) return

      const key = e.key
      // Prevent default for keys we handle to avoid scrolling, etc.
      if (
        (key >= '1' && key <= '9') ||
        ['Backspace', 'Delete', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)
      ) {
        e.preventDefault()
      }

      if (key >= '1' && key <= '9') {
        const value = parseInt(key, 10)
        actions.inputValue(value)
        actions.setHighlightedValue(value)
      } else if (key === 'Backspace') {
        actions.eraseActiveCell('backspace')
      } else if (key === 'Delete') {
        actions.eraseActiveCell('delete')
      } else if (key === 'ArrowUp') {
        actions.navigate('up')
      } else if (key === 'ArrowDown') {
        actions.navigate('down')
      } else if (key === 'ArrowLeft') {
        actions.navigate('left')
      } else if (key === 'ArrowRight') {
        actions.navigate('right')
      }
    },
    [isReadOnly, actions],
  )

  // Effect to handle focus leaving the grid entirely.
  const handleGridBlur = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      // If the element receiving focus is not a cell within this grid, deselect.
      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
        actions.setActiveCell(null)
      }
    },
    [actions],
  )

  if (!displayBoard) {
    // This can happen briefly if visualizing but the board hasn't been calculated yet.
    // Can be replaced with a skeleton loader.
    return null
  }

  return (
    <div
      role="grid"
      onKeyDown={handleKeyDown}
      onBlur={handleGridBlur}
      className="grid aspect-square grid-cols-9 overflow-hidden rounded-lg border-2 border-primary shadow-lg"
    >
      {displayBoard.map((_, index) => {
        const isInitial = initialBoard[index]?.value != null
        const isVisualizing = gameMode === 'visualizing'

        // In visualization mode, we construct a synthetic cell state for rendering.
        // Otherwise, we use the cell state from the main board.
        const displayCell: CellState = isVisualizing
          ? {
            value: displayBoard[index].value,
            // Candidates are from the state *before* the current step.
            candidates: candidatesForViz?.[index] ?? new Set(),
            // Center marks are not shown during visualization.
            centers: new Set(),
          }
          : displayBoard[index]

        const eliminatedCandidates = isVisualizing
          ? new Set(
            eliminationsForViz
              ?.filter((e) => e.index === index)
              .map((e) => e.value),
          )
          : undefined

        return (
          <SudokuCell
            ref={cellRefs[index]}
            key={`cell-${index}`}
            index={index}
            cell={displayCell}
            isInitial={isInitial}
            isSolving={isSolving}
            isSolved={isSolved}
            isConflict={conflicts.has(index)}
            isActive={activeCellIndex === index}
            isHighlighted={highlightedIndices.has(index)}
            isNumberHighlighted={
              displayCell.value !== null &&
              displayCell.value === highlightedValue
            }
            onFocus={handleCellFocus}
            eliminatedCandidates={eliminatedCandidates}
          />
        )
      })}
    </div>
  )
}
