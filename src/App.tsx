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

import { useState, useEffect, useRef, useCallback } from 'react'
import { Eraser, BrainCircuit, Undo, Redo } from 'lucide-react'
import { SiGithub } from 'react-icons/si'
import { Button } from '@/components/ui/button'
import { ModeToggle } from '@/components/mode-toggle'
import { SudokuGrid } from '@/components/SudokuGrid'
import { useSudoku, type InputMode } from '@/hooks/useSudoku'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { NumberPad } from '@/components/NumberPad'

function App() {
  const {
    board,
    initialBoard,
    isSolving,
    isSolved,
    conflicts,
    activeCellIndex,
    inputMode,
    isSolveDisabled,
    isClearDisabled,
    solveButtonTitle,
    clearButtonTitle,
    canUndo,
    canRedo,
    setActiveCellIndex,
    setInputMode,
    setCellValue,
    togglePencilMark,
    eraseCell,
    clearBoard,
    solve,
    undo,
    redo,
  } = useSudoku()

  const [isShowingSolvingState, setIsShowingSolvingState] = useState(false)
  const solveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const interactionAreaRef = useRef<HTMLDivElement>(null)

  // This effect manages the delayed "Solving..." state to avoid UI flicker for very fast solves.
  useEffect(() => {
    if (isSolving) {
      // If solving starts, set a timer to show the "Solving..." state after 500ms.
      solveTimerRef.current = setTimeout(() => {
        setIsShowingSolvingState(true)
      }, 500)
    } else {
      // If solving ends (success or fail), clear any pending timer and hide the state.
      if (solveTimerRef.current) {
        clearTimeout(solveTimerRef.current)
      }
      setIsShowingSolvingState(false)
    }

    // Cleanup the timer on component unmount or when isSolving changes.
    return () => {
      if (solveTimerRef.current) {
        clearTimeout(solveTimerRef.current)
      }
    }
  }, [isSolving])

  const handleErase = useCallback(() => {
    if (activeCellIndex !== null) {
      eraseCell(activeCellIndex)
    }
  }, [activeCellIndex, eraseCell])

  const handleCellChange = useCallback(
    (index: number, value: number | null) => {
      if (value === null) {
        eraseCell(index)
        return
      }

      if (inputMode === 'normal') {
        setCellValue(index, value)
      } else {
        togglePencilMark(index, value, inputMode)
      }
    },
    [inputMode, setCellValue, togglePencilMark, eraseCell],
  )

  const handleNumberPadClick = useCallback(
    (value: number) => {
      if (activeCellIndex !== null) {
        handleCellChange(activeCellIndex, value)
      }
    },
    [activeCellIndex, handleCellChange],
  )

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="container mx-auto flex items-center justify-between p-4">
        <h1 className="text-2xl font-bold md:text-3xl">WASudoku</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" asChild>
            <a
              href="https://github.com/h3nc4/WASudoku"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub Repository"
            >
              <SiGithub className="size-5" />
            </a>
          </Button>
          <ModeToggle />
        </div>
      </header>

      <main className="container mx-auto flex flex-1 flex-col items-center justify-center p-4">
        <div
          ref={interactionAreaRef}
          className="flex w-full max-w-md flex-col gap-6 md:gap-8"
        >
          <SudokuGrid
            board={board}
            initialBoard={initialBoard}
            isSolving={isSolving}
            isSolved={isSolved}
            conflicts={conflicts}
            activeCellIndex={activeCellIndex}
            inputMode={inputMode}
            onCellChange={handleCellChange}
            onCellFocus={setActiveCellIndex}
            interactionAreaRef={interactionAreaRef}
          />

          <div className="flex flex-col gap-4">
            <div className="flex flex-row gap-2">
              <ToggleGroup
                type="single"
                value={inputMode}
                onValueChange={(value) => {
                  if (value) setInputMode(value as InputMode)
                }}
                className="flex-1"
                aria-label="Input Mode"
              >
                <ToggleGroupItem value="normal" className="flex-1">
                  Normal
                </ToggleGroupItem>
                <ToggleGroupItem value="candidate" className="flex-1">
                  Candidate
                </ToggleGroupItem>
                <ToggleGroupItem value="center" className="flex-1">
                  Center
                </ToggleGroupItem>
              </ToggleGroup>
              <Button
                variant="outline"
                size="icon"
                onMouseDown={handleErase}
                disabled={activeCellIndex === null}
                title="Erase selected cell"
              >
                <Eraser />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={undo}
                disabled={!canUndo}
                title="Undo"
              >
                <Undo />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={redo}
                disabled={!canRedo}
                title="Redo"
              >
                <Redo />
              </Button>
            </div>

            <NumberPad
              onNumberClick={handleNumberPadClick}
              disabled={activeCellIndex === null}
            />

            <div className="flex w-full flex-row gap-2">
              <Button
                onClick={solve}
                className="flex-1"
                disabled={isSolveDisabled}
                title={solveButtonTitle}
              >
                {isShowingSolvingState ? (
                  <>
                    <BrainCircuit className="mr-2 size-4 animate-pulse" />
                    Solving...
                  </>
                ) : (
                  'Solve Puzzle'
                )}
              </Button>
              <Button
                variant="secondary"
                onClick={clearBoard}
                className="flex-1"
                disabled={isClearDisabled}
                title={clearButtonTitle}
              >
                <Eraser className="mr-2 size-4" />
                Clear Board
              </Button>
            </div>
          </div>
        </div>
      </main>

      <footer className="container mx-auto p-4 text-center text-sm text-muted-foreground">
        <a
          href="https://h3nc4.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:no-underline"
        >
          <p>🄯 2025 Henrique Almeida.</p>
          <p>Because knowledge should be free.</p>
        </a>
      </footer>
    </div>
  )
}

export default App
