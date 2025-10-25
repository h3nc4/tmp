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
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { useSudokuState } from '@/context/sudoku.hooks'
import { useSudokuActions } from '@/hooks/useSudokuActions'
import type { SolvingStep } from '@/context/sudoku.types'
import { formatCell } from '@/lib/utils'

/**
 * Generates a human-readable explanation for a given solving step.
 * @param step - The `SolvingStep` object from the solver.
 * @returns A string explaining the step's logic.
 */
const getStepExplanation = (step: SolvingStep): string => {
  const { technique, placements, cause } = step

  // Helper to format a list of numbers (e.g., {1, 2, 3})
  const formatNums = (nums: number[]) => `{${[...nums].sort((a, b) => a - b).join(', ')}}`
  // Helper to format a list of cell coordinates
  const formatCells = (indices: number[]) =>
    indices.map(formatCell).join(', ')

  switch (technique) {
    case 'NakedSingle': {
      const { index, value } = placements[0]
      return `Cell ${formatCell(index)} had only one possible candidate remaining: ${value}. This is a Naked Single.`
    }
    case 'HiddenSingle': {
      const { index, value } = placements[0]
      return `Within its row, column, or box, the number ${value} could only be placed in cell ${formatCell(index)}. This is a Hidden Single.`
    }
    case 'NakedPair': {
      const cells = formatCells(cause.map((c) => c.index))
      const candidates = formatNums(cause[0].candidates)
      return `Naked Pair: Cells ${cells} can only contain the candidates ${candidates}. Therefore, these candidates were removed from other cells in the same unit.`
    }
    case 'HiddenPair': {
      const cells = formatCells(cause.map((c) => c.index))
      const candidates = formatNums(cause[0].candidates)
      return `Hidden Pair: In their shared unit, the candidates ${candidates} only appear in cells ${cells}. Therefore, all other candidates were removed from these two cells.`
    }
    case 'NakedTriple': {
      const cells = formatCells(cause.map((c) => c.index))
      const candidates = formatNums(cause[0].candidates)
      return `Naked Triple: Cells ${cells} form a triple with candidates ${candidates}. Therefore, these candidates were removed from other cells in the same unit.`
    }
    case 'HiddenTriple': {
      const cells = formatCells(cause.map((c) => c.index))
      const candidates = formatNums(cause[0].candidates)
      return `Hidden Triple: In their shared unit, the candidates ${candidates} only appear in cells ${cells}. Therefore, all other candidates were removed from these three cells.`
    }
    case 'PointingPair':
    case 'PointingTriple': {
      const candidates = formatNums(cause[0].candidates)
      return `Pointing Subgroup: The candidates ${candidates} in one box are confined to a single row or column. They were eliminated from the rest of that line.`
    }
    case 'Backtracking':
      return 'The available logical techniques were not sufficient to solve the puzzle. A backtracking (brute-force) algorithm was used to find the solution.'
    default:
      return `Technique used: ${technique}.`
  }
}

/**
 * A panel that displays the step-by-step logical solution from the solver.
 * It allows the user to navigate through the steps and see the board state at each point.
 */
export function SolverStepsPanel() {
  const { solver } = useSudokuState()
  const { viewSolverStep } = useSudokuActions()
  const { steps, currentStepIndex } = solver

  const handleStepSelect = useCallback(
    (index: number) => {
      viewSolverStep(index)
    },
    [viewSolverStep],
  )

  const handleAccordionChange = (value: string) => {
    // Only dispatch when an item is opened, not when closed (value is empty string).
    if (value) {
      // Dispatch `stepIndex + 1` because `viewSolverStep(N)` applies N steps.
      handleStepSelect(parseInt(value, 10) + 1)
    }
  }

  if (steps.length === 0) {
    return null
  }

  // `currentStepIndex` is 1-based for steps, 0 for initial state.
  // The accordion's active item value is the 0-based step index.
  const activeAccordionItem =
    currentStepIndex !== null && currentStepIndex > 0
      ? (currentStepIndex - 1).toString()
      : ''

  return (
    <div className="flex h-full flex-col gap-2 rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
      <h2 className="text-lg font-semibold">Solving Steps</h2>
      <Button
        variant={currentStepIndex === 0 ? 'secondary' : 'ghost'}
        data-state={currentStepIndex === 0 ? 'active' : 'inactive'}
        size="sm"
        onClick={() => handleStepSelect(0)}
      >
        Initial Board State
      </Button>
      <ScrollArea className="flex-1 overflow-auto">
        <Accordion
          type="single"
          collapsible
          value={activeAccordionItem}
          onValueChange={handleAccordionChange}
        >
          {steps.map((step, index) => (
            <AccordionItem
              key={`step-${index}-${step.technique}`}
              value={index.toString()}
            >
              <AccordionTrigger>
                Step {index + 1}: {step.technique}
              </AccordionTrigger>
              <AccordionContent>
                {getStepExplanation(step)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </ScrollArea>
      <Button
        variant={currentStepIndex === steps.length ? 'secondary' : 'ghost'}
        data-state={currentStepIndex === steps.length ? 'active' : 'inactive'}
        size="sm"
        onClick={() => handleStepSelect(steps.length)}
      >
        Solution
      </Button>
    </div>
  )
}
