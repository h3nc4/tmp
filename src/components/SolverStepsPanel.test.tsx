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

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest'
import { SolverStepsPanel } from './SolverStepsPanel'
import { useSudokuState } from '@/context/sudoku.hooks'
import { useSudokuActions } from '@/hooks/useSudokuActions'
import { initialState } from '@/context/sudoku.reducer'
import type { SudokuState, SolvingStep } from '@/context/sudoku.types'

// Mocks
vi.mock('@/context/sudoku.hooks')
vi.mock('@/hooks/useSudokuActions')

const mockUseSudokuState = useSudokuState as Mock
const mockUseSudokuActions = useSudokuActions as Mock

const mockSteps: SolvingStep[] = [
  {
    technique: 'NakedSingle',
    placements: [{ index: 0, value: 5 }],
    eliminations: [],
    cause: [],
  },
  {
    technique: 'HiddenSingle',
    placements: [{ index: 10, value: 3 }],
    eliminations: [],
    cause: [],
  },
  {
    technique: 'NakedPair',
    placements: [],
    eliminations: [],
    cause: [
      { index: 1, candidates: [4, 6] },
      { index: 2, candidates: [4, 6] },
    ],
  },
  {
    technique: 'HiddenPair',
    placements: [],
    eliminations: [],
    cause: [
      { index: 20, candidates: [7, 8] },
      { index: 21, candidates: [7, 8] },
    ],
  },
  {
    technique: 'NakedTriple',
    placements: [],
    eliminations: [],
    cause: [
      { index: 30, candidates: [1, 2, 3] },
      { index: 31, candidates: [1, 2, 3] },
      { index: 32, candidates: [1, 2, 3] },
    ],
  },
  {
    technique: 'HiddenTriple',
    placements: [],
    eliminations: [],
    cause: [
      { index: 40, candidates: [5, 6, 9] },
      { index: 41, candidates: [5, 6, 9] },
      { index: 42, candidates: [5, 6, 9] },
    ],
  },
  {
    technique: 'PointingPair',
    placements: [],
    eliminations: [],
    cause: [{ index: 60, candidates: [8] }],
  },
  {
    technique: 'PointingTriple',
    placements: [],
    eliminations: [],
    cause: [{ index: 50, candidates: [1] }],
  },
  {
    technique: 'Backtracking',
    placements: [],
    eliminations: [],
    cause: [],
  },
]

describe('SolverStepsPanel component', () => {
  const mockViewSolverStep = vi.fn()
  const defaultState: SudokuState = {
    ...initialState,
    solver: {
      ...initialState.solver,
      gameMode: 'visualizing',
      steps: mockSteps,
      currentStepIndex: mockSteps.length, // Start at solution
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSudokuState.mockReturnValue(defaultState)
    mockUseSudokuActions.mockReturnValue({
      viewSolverStep: mockViewSolverStep,
    })
  })

  it('renders nothing if there are no solver steps', () => {
    mockUseSudokuState.mockReturnValue({
      ...defaultState,
      solver: { ...defaultState.solver, steps: [] },
    })
    const { container } = render(<SolverStepsPanel />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the panel with initial, final, and all step buttons', () => {
    render(<SolverStepsPanel />)
    expect(
      screen.getByRole('heading', { name: 'Solving Steps' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Initial Board State' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Solution' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Step 1: NakedSingle/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Step 9: Backtracking/ }),
    ).toBeInTheDocument()
  })

  it('calls viewSolverStep(0) when "Initial Board State" is clicked', async () => {
    const user = userEvent.setup()
    render(<SolverStepsPanel />)
    await user.click(
      screen.getByRole('button', { name: 'Initial Board State' }),
    )
    expect(mockViewSolverStep).toHaveBeenCalledWith(0)
  })

  it('calls viewSolverStep(steps.length) when "Solution" is clicked', async () => {
    const user = userEvent.setup()
    render(<SolverStepsPanel />)
    await user.click(screen.getByRole('button', { name: 'Solution' }))
    expect(mockViewSolverStep).toHaveBeenCalledWith(mockSteps.length)
  })

  it('calls viewSolverStep when an accordion trigger is clicked', async () => {
    const user = userEvent.setup()
    render(<SolverStepsPanel />)

    // Click step 2 (index 1)
    const step2Button = screen.getByRole('button', { name: /Step 2: HiddenSingle/ })
    await user.click(step2Button)

    // Should dispatch index + 1
    expect(mockViewSolverStep).toHaveBeenCalledWith(2)
  })

  it('highlights the correct buttons based on currentStepIndex', () => {
    // When viewing step 1 (index 0), its accordion should be active
    mockUseSudokuState.mockReturnValue({
      ...defaultState,
      solver: { ...defaultState.solver, currentStepIndex: 1 },
    })
    const { rerender } = render(<SolverStepsPanel />)

    const step1Button = screen.getByRole('button', { name: /Step 1: NakedSingle/ })
    expect(step1Button).toHaveAttribute('data-state', 'open')

    // When viewing initial state
    mockUseSudokuState.mockReturnValue({
      ...defaultState,
      solver: { ...defaultState.solver, currentStepIndex: 0 },
    })
    rerender(<SolverStepsPanel />)
    expect(
      screen.getByRole('button', { name: 'Initial Board State' }),
    ).toHaveAttribute('data-state', 'active')
    expect(
      screen.getByRole('button', { name: 'Solution' }),
    ).toHaveAttribute('data-state', 'inactive')

    // When viewing final state
    mockUseSudokuState.mockReturnValue({
      ...defaultState,
      solver: { ...defaultState.solver, currentStepIndex: mockSteps.length },
    })
    rerender(<SolverStepsPanel />)
    expect(
      screen.getByRole('button', { name: 'Solution' }),
    ).toHaveAttribute('data-state', 'active')
    expect(
      screen.getByRole('button', { name: 'Initial Board State' }),
    ).toHaveAttribute('data-state', 'inactive')
  })

  describe('Step Explanations', () => {
    const testCases: {
      stepIndex: number
      expectedText: RegExp
    }[] = [
        { stepIndex: 1, expectedText: /Cell R1C1 had only one possible candidate/ },
        { stepIndex: 3, expectedText: /Naked Pair: Cells R1C2, R1C3 can only contain the candidates \{4, 6\}/ },
        { stepIndex: 4, expectedText: /Hidden Pair: In their shared unit, the candidates \{7, 8\} only appear in cells R3C3, R3C4/ },
        { stepIndex: 5, expectedText: /Naked Triple: Cells R4C4, R4C5, R4C6 form a triple with candidates \{1, 2, 3\}/ },
        { stepIndex: 6, expectedText: /Hidden Triple: In their shared unit, the candidates \{5, 6, 9\} only appear in cells R5C5, R5C6, R5C7/ },
        { stepIndex: 7, expectedText: /Pointing Subgroup: The candidates \{8\} in one box are confined/ },
        { stepIndex: 8, expectedText: /Pointing Subgroup: The candidates \{1\} in one box are confined/ },
      ]

    for (const { stepIndex, expectedText } of testCases) {
      it(`shows the correct explanation for step ${stepIndex}`, async () => {
        mockUseSudokuState.mockReturnValue({
          ...defaultState,
          solver: { ...defaultState.solver, currentStepIndex: stepIndex },
        })
        render(<SolverStepsPanel />)
        expect(await screen.findByText(expectedText)).toBeInTheDocument()
      })
    }

    it('shows the correct explanation for a default/unknown case', async () => {
      const magicSteps = [
        { technique: 'Magic', placements: [], eliminations: [], cause: [] },
      ]
      mockUseSudokuState.mockReturnValue({
        ...defaultState,
        solver: {
          ...defaultState.solver,
          steps: magicSteps,
          currentStepIndex: 1,
        },
      })
      render(<SolverStepsPanel />)
      expect(await screen.findByText('Technique used: Magic.')).toBeInTheDocument()
    })
  })

  it('does not call viewSolverStep when an accordion item is closed', async () => {
    const user = userEvent.setup()
    // Start with an item open
    mockUseSudokuState.mockReturnValue({
      ...defaultState,
      solver: { ...defaultState.solver, currentStepIndex: 1 },
    })
    render(<SolverStepsPanel />)

    mockViewSolverStep.mockClear()

    // Click the already-open trigger to close it
    const step1Button = screen.getByRole('button', { name: /Step 1: NakedSingle/ })
    await user.click(step1Button)

    // No new action should have been called
    expect(mockViewSolverStep).not.toHaveBeenCalled()
  })
})
