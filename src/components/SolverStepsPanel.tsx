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

/**
 * Generates a human-readable explanation for a given solving step.
 * @param step - The `SolvingStep` object from the solver.
 * @returns A string explaining the step's logic.
 */
const getStepExplanation = (step: SolvingStep): string => {
  switch (step.technique) {
    case 'NakedSingle': {
      const { index, value } = step.placements[0]
      const row = Math.floor(index / 9) + 1
      const col = (index % 9) + 1
      return `Cell R${row}C${col} had only one possible candidate remaining: ${value}. This is a Naked Single.`
    }
    case 'HiddenSingle': {
      const { index, value } = step.placements[0]
      const row = Math.floor(index / 9) + 1
      const col = (index % 9) + 1
      return `Within its row, column, or box, the number ${value} could only be placed in cell R${row}C${col}. This is a Hidden Single.`
    }
    case 'Backtracking':
      return 'The available logical techniques were not sufficient to solve the puzzle. A backtracking (brute-force) algorithm was used to find the solution.'
    default:
      return `Technique used: ${step.technique}.`
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
    // Accordion's `onValueChange` is called with an empty string when an item is closed.
    // We only want to dispatch when an item is opened.
    if (value) {
      // The accordion value is the step index (0-based) as a string.
      // We need to dispatch `stepIndex + 1` because `viewSolverStep(N)` applies N steps.
      handleStepSelect(parseInt(value, 10) + 1)
    }
  }

  if (steps.length === 0) {
    return null
  }

  // The accordion's active item is based on the step index (0-based).
  // `currentStepIndex` is the number of steps applied (1-based for steps, 0 for initial).
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
