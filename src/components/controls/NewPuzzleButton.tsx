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

import { useState, useEffect, useRef } from 'react'
import { Wand2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSudokuState } from '@/context/sudoku.hooks'
import { useSudokuActions } from '@/hooks/useSudokuActions'

const DIFFICULTY_LEVELS = ['Easy', 'Medium', 'Hard', 'Extreme']

/**
 * A button with a dropdown menu to generate a new Sudoku puzzle.
 * It shows a loading state while the puzzle is being generated in a web worker.
 */
export function NewPuzzleButton() {
  const { solver } = useSudokuState()
  const { generatePuzzle } = useSudokuActions()

  const [isShowingGeneratingState, setIsShowingGeneratingState] = useState(false)
  const generationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isButtonDisabled = solver.isGenerating || solver.isSolving

  const handleSelectDifficulty = (difficulty: string) => {
    generatePuzzle(difficulty.toLowerCase())
  }

  // Effect to manage the "Generating..." label with a delay,
  // preventing a jarring flash of text for very fast generations.
  useEffect(() => {
    if (solver.isGenerating) {
      generationTimerRef.current = setTimeout(() => {
        setIsShowingGeneratingState(true)
      }, 300)
    } else {
      if (generationTimerRef.current) {
        clearTimeout(generationTimerRef.current)
      }
      setIsShowingGeneratingState(false)
    }
    return () => {
      if (generationTimerRef.current) {
        clearTimeout(generationTimerRef.current)
      }
    }
  }, [solver.isGenerating])

  if (isShowingGeneratingState) {
    return (
      <Button disabled className="flex-1">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Generating...
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          className="flex-1"
          disabled={isButtonDisabled}
          onMouseDown={(e) => e.preventDefault()}
        >
          <Wand2 className="mr-2 size-4" />
          New Puzzle
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {DIFFICULTY_LEVELS.map((level) => (
          <DropdownMenuItem key={level} onSelect={() => handleSelectDifficulty(level)}>
            {level}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
