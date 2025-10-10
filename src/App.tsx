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

import { Eraser } from 'lucide-react'
import { SiGithub } from 'react-icons/si'
import { Button } from '@/components/ui/button'
import { ModeToggle } from '@/components/mode-toggle'
import { SudokuGrid } from '@/components/SudokuGrid'
import { useSudoku } from '@/hooks/useSudoku'

function App() {
  const {
    wasmReady,
    board,
    initialBoard,
    isSolving,
    setCellValue,
    clearBoard,
    solve,
  } = useSudoku()

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
            onCellChange={setCellValue}
          />
        </div>

        <div className="flex w-full max-w-md flex-row gap-2">
          <Button
            onClick={solve}
            className="flex-1"
            disabled={!wasmReady || isSolving}
          >
            {isSolving
              ? 'Solving...'
              : wasmReady
                ? 'Solve Puzzle'
                : 'Loading Solver...'}
          </Button>
          <Button
            variant="secondary"
            onClick={clearBoard}
            className="flex-1"
            disabled={isSolving}
          >
            <Eraser className="mr-2 size-4" />
            Clear Board
          </Button>
        </div>
      </main>

      <footer className="container mx-auto p-4 text-center text-sm text-muted-foreground">
        <p>🄯 2025 Henrique Almeida.</p>
        <p>Because knowledge should be free.</p>
      </footer>
    </div>
  )
}

export default App
