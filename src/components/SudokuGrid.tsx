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
import {
  useSudokuState,
  useSudokuDispatch,
} from '@/context/sudoku.hooks'
import {
  setActiveCell,
  inputValue,
  eraseActiveCell,
  navigate,
} from '@/context/sudoku.actions'

interface SudokuGridProps {
  /** A ref to the parent element containing all interactive game components. */
  readonly interactionAreaRef: React.RefObject<HTMLDivElement | null>
}

/**
 * Renders the 9x9 Sudoku grid container and manages all keyboard interactions.
 * It orchestrates focus management and dispatches actions for cell changes.
 */
export function SudokuGrid({ interactionAreaRef }: SudokuGridProps) {
  const {
    board,
    initialBoard,
    isSolving,
    isSolved,
    activeCellIndex,
    conflicts,
  } = useSudokuState()
  const dispatch = useSudokuDispatch()

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
      dispatch(setActiveCell(index))
    },
    [dispatch],
  )

  // Centralized keyboard handler for the entire grid.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (activeCellIndex === null || isSolving) return

      const key = e.key
      // Prevent default for keys we handle to avoid scrolling, etc.
      if (
        (key >= '1' && key <= '9') ||
        ['Backspace', 'Delete', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)
      ) {
        e.preventDefault()
      }

      if (key >= '1' && key <= '9') {
        dispatch(inputValue(parseInt(key, 10)))
      } else if (key === 'Backspace') {
        dispatch(eraseActiveCell('backspace'))
      } else if (key === 'Delete') {
        dispatch(eraseActiveCell('delete'))
      } else if (key === 'ArrowUp') {
        dispatch(navigate('up'))
      } else if (key === 'ArrowDown') {
        dispatch(navigate('down'))
      } else if (key === 'ArrowLeft') {
        dispatch(navigate('left'))
      } else if (key === 'ArrowRight') {
        dispatch(navigate('right'))
      }
    },
    [activeCellIndex, isSolving, dispatch],
  )

  // Effect to handle clicks outside the defined interaction area to deselect cells.
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        interactionAreaRef.current &&
        !interactionAreaRef.current.contains(event.target as Node)
      ) {
        dispatch(setActiveCell(null)) // Deselect the cell
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [interactionAreaRef, dispatch])

  return (
    <div
      role="grid"
      onKeyDown={handleKeyDown}
      className="grid aspect-square grid-cols-9 overflow-hidden rounded-lg border-2 border-primary shadow-lg"
    >
      {board.map((cell, index) => {
        const isInitial = initialBoard[index]?.value != null
        return (
          <SudokuCell
            ref={cellRefs[index]}
            key={`cell-${index}`}
            index={index}
            cell={cell}
            isInitial={isInitial}
            isSolving={isSolving}
            isSolved={isSolved}
            isConflict={conflicts.has(index)}
            isActive={activeCellIndex === index}
            isHighlighted={highlightedIndices.has(index)}
            onFocus={handleCellFocus}
          />
        )
      })}
    </div>
  )
}
