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

import { useCallback } from 'react'
import { Eraser } from 'lucide-react'
import { SiGithub } from 'react-icons/si'
import { Button } from '@/components/ui/button'
import { ModeToggle } from '@/components/mode-toggle'
import { SudokuGrid } from '@/components/SudokuGrid'
import { NumberPad } from '@/components/NumberPad'
import {
  useSudokuState,
  useSudokuDispatch,
} from './context/sudoku.hooks'
import { SolveButton } from './components/controls/SolveButton'
import { ClearButton } from './components/controls/ClearButton'
import { UndoRedo } from './components/controls/UndoRedo'
import { InputModeToggle } from './components/controls/InputModeToggle'
import { eraseActiveCell } from './context/sudoku.actions'

function App() {
  const { activeCellIndex } = useSudokuState()
  const dispatch = useSudokuDispatch()

  const handleErase = useCallback(() => {
    if (activeCellIndex !== null) {
      dispatch(eraseActiveCell('delete'))
    }
  }, [activeCellIndex, dispatch])

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
        <div className="flex w-full max-w-md flex-col gap-6 md:gap-8">
          <SudokuGrid />

          <div className="flex flex-col gap-4">
            <div className="flex flex-row gap-2">
              <InputModeToggle />
              <Button
                variant="outline"
                size="icon"
                onClick={handleErase}
                disabled={activeCellIndex === null}
                title="Erase selected cell"
                onMouseDown={(e) => e.preventDefault()}
              >
                <Eraser />
              </Button>
              <UndoRedo />
            </div>

            <NumberPad />

            <div className="flex w-full flex-row gap-2">
              <SolveButton />
              <ClearButton />
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
