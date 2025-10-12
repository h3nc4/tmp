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

import { useMemo, useState, useEffect, useRef } from 'react'
import { Eraser, BrainCircuit } from 'lucide-react'
import { SiGithub } from 'react-icons/si'
import { Button } from '@/components/ui/button'
import { ModeToggle } from '@/components/mode-toggle'
import { SudokuGrid } from '@/components/SudokuGrid'
import { useSudoku } from '@/hooks/useSudoku'

function App() {
  const {
    board,
    initialBoard,
    isSolving,
    isSolved,
    conflicts,
    activeCellIndex,
    solveFailed,
    setActiveCellIndex,
    setCellValue,
    clearBoard,
    solve,
  } = useSudoku()

  const [isShowingSolvingState, setIsShowingSolvingState] = useState(false)
  const solveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // This effect manages the delayed "Solving..." state to avoid UI flicker.
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

  const isBoardEmpty = useMemo(() => board.every((cell) => cell === null), [
    board,
  ])
  const isBoardFull = useMemo(() => board.every((cell) => cell !== null), [
    board,
  ])
  const hasConflicts = conflicts.size > 0

  const isSolveDisabled =
    isSolving || isBoardEmpty || isBoardFull || hasConflicts || solveFailed
  const isClearDisabled = isSolving || isBoardEmpty

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

      <main className="container mx-auto flex flex-1 flex-col items-center justify-center gap-6 p-4 md:gap-8">
        <div className="w-full max-w-md">
          <SudokuGrid
            board={board}
            initialBoard={initialBoard}
            isSolving={isSolving}
            isSolved={isSolved}
            conflicts={conflicts}
            activeCellIndex={activeCellIndex}
            onCellChange={setCellValue}
            onCellFocus={setActiveCellIndex}
          />
        </div>

        <div className="flex w-full max-w-md flex-row gap-2">
          <Button
            onClick={solve}
            className="flex-1"
            disabled={isSolveDisabled}
            title={
              hasConflicts
                ? 'Cannot solve with conflicts.'
                : isBoardFull
                  ? 'Board is already full.'
                  : isBoardEmpty
                    ? 'Board is empty.'
                    : solveFailed
                      ? 'Solving failed. Please change the board to try again.'
                      : 'Solve the puzzle'
            }
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
            title={isBoardEmpty ? 'Board is already empty.' : 'Clear the board'}
          >
            <Eraser className="mr-2 size-4" />
            Clear Board
          </Button>
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
