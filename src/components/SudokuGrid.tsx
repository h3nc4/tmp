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
import { toast } from 'sonner'
import SudokuCell from './SudokuCell'
import { getRelatedCellIndices, isBoardStringValid } from '@/lib/utils'
import { useSudokuState, useSudokuDispatch } from '@/context/sudoku.hooks'
import { useSudokuActions } from '@/hooks/useSudokuActions'
import { importBoard } from '@/context/sudoku.actions'
import type { CellState } from '@/context/sudoku.types'

/**
 * Renders the 9x9 Sudoku grid container and manages all keyboard interactions.
 * It orchestrates focus management and dispatches actions for cell changes.
 */
export function SudokuGrid() {
  const { board, initialBoard, ui, solver, derived } = useSudokuState()
  const dispatch = useSudokuDispatch()
  const actions = useSudokuActions()

  const displayBoard =
    solver.gameMode === 'visualizing' ? solver.visualizationBoard : board
  const isReadOnly = solver.gameMode === 'visualizing' || solver.isSolving

  const cellRefs = useMemo(
    () => Array.from({ length: 81 }, () => createRef<HTMLInputElement>()),
    [],
  )

  const highlightedIndices = useMemo(() => {
    if (ui.activeCellIndex === null) {
      return new Set<number>()
    }
    return getRelatedCellIndices(ui.activeCellIndex)
  }, [ui.activeCellIndex])

  const causeIndices = useMemo(() => {
    if (
      solver.gameMode !== 'visualizing' ||
      solver.currentStepIndex === null ||
      solver.currentStepIndex === 0
    ) {
      return new Set<number>()
    }
    const currentStep = solver.steps[solver.currentStepIndex - 1]
    if (!currentStep?.cause) {
      return new Set<number>()
    }
    return new Set(currentStep.cause.map((c) => c.index))
  }, [solver.gameMode, solver.currentStepIndex, solver.steps])

  // Effect to declaratively manage focus based on the activeCellIndex state.
  useEffect(() => {
    if (ui.activeCellIndex !== null && cellRefs[ui.activeCellIndex]?.current) {
      cellRefs[ui.activeCellIndex].current?.focus()
    }
  }, [ui.activeCellIndex, cellRefs])

  const handleCellFocus = useCallback(
    (index: number) => {
      if (!isReadOnly) {
        actions.setActiveCell(index)
      }
    },
    [actions, isReadOnly],
  )

  const handlePaste = useCallback(
    async (event: React.ClipboardEvent) => {
      event.preventDefault()
      try {
        const text = await navigator.clipboard.readText()
        if (isBoardStringValid(text)) {
          dispatch(importBoard(text))
          toast.success('Board imported from clipboard.')
        } else {
          toast.error('Invalid board format in clipboard.')
        }
      } catch (err) {
        toast.error('Could not read from clipboard.')
      }
    },
    [dispatch],
  )

  // Centralized keyboard handler for the entire grid.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isReadOnly) return

      const key = e.key
      // Prevent default for handled keys to avoid scrolling.
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
    return null
  }

  return (
    <div
      role="grid"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onBlur={handleGridBlur}
      onPaste={handlePaste}
      className="grid aspect-square grid-cols-9 overflow-hidden rounded-lg border-2 border-primary shadow-lg"
    >
      {displayBoard.map((currentCell, index) => {
        const isInitial = initialBoard[index]?.value != null
        const isVisualizing = solver.gameMode === 'visualizing'

        const displayCell: CellState = isVisualizing
          ? {
            value: currentCell.value,
            candidates: solver.candidatesForViz?.[index] ?? new Set(),
            centers: new Set(),
          }
          : currentCell

        const eliminatedCandidates = isVisualizing
          ? new Set(
            solver.eliminationsForViz
              ?.filter((e) => e.index === index)
              .map((e) => e.value),
          )
          : undefined

        const row = Math.floor(index / 9)
        const col = index % 9

        return (
          <SudokuCell
            ref={cellRefs[index]}
            // For a static 9x9 grid, the row and column form a stable, unique key.
            key={`cell-r${row}-c${col}`}
            index={index}
            cell={displayCell}
            isInitial={isInitial}
            isSolving={solver.isSolving}
            isSolved={solver.isSolved}
            isConflict={derived.conflicts.has(index)}
            isActive={ui.activeCellIndex === index}
            isHighlighted={highlightedIndices.has(index)}
            isNumberHighlighted={
              displayCell.value !== null &&
              displayCell.value === ui.highlightedValue
            }
            isCause={causeIndices.has(index)}
            onFocus={handleCellFocus}
            eliminatedCandidates={eliminatedCandidates}
          />
        )
      })}
    </div>
  )
}
