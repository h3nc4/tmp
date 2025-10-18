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
    gameMode: 'visualizing',
    solverSteps: mockSteps,
    currentStepIndex: mockSteps.length, // Start at solution
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSudokuState.mockReturnValue(defaultState)
    mockUseSudokuActions.mockReturnValue({
      viewSolverStep: mockViewSolverStep,
    })
  })

  it('renders nothing if there are no solver steps', () => {
    mockUseSudokuState.mockReturnValue({ ...defaultState, solverSteps: [] })
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
      screen.getByRole('button', { name: /Step 3: Backtracking/ }),
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
    expect(mockViewSolverStep).toHaveBeenCalledWith(3)
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
    mockUseSudokuState.mockReturnValue({ ...defaultState, currentStepIndex: 1 })
    const { rerender } = render(<SolverStepsPanel />)

    const step1Button = screen.getByRole('button', { name: /Step 1: NakedSingle/ })
    expect(step1Button).toHaveAttribute('data-state', 'open')

    // When viewing initial state
    mockUseSudokuState.mockReturnValue({ ...defaultState, currentStepIndex: 0 })
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
      currentStepIndex: mockSteps.length,
    })
    rerender(<SolverStepsPanel />)
    expect(
      screen.getByRole('button', { name: 'Solution' }),
    ).toHaveAttribute('data-state', 'active')
    expect(
      screen.getByRole('button', { name: 'Initial Board State' }),
    ).toHaveAttribute('data-state', 'inactive')
  })

  it('shows the correct explanation when an accordion item is expanded', async () => {
    // Start with no item selected and mock the state change that would happen on click
    mockUseSudokuState.mockReturnValue({ ...defaultState, currentStepIndex: 1 })
    const { rerender } = render(<SolverStepsPanel />)

    // Now, wait for the content to appear
    expect(
      await screen.findByText(/Cell R1C1 had only one possible candidate/),
    ).toBeInTheDocument()

    // Test default case for unknown technique
    const magicSteps = [
      { technique: 'Magic', placements: [], eliminations: [], cause: [] },
    ]
    mockUseSudokuState.mockReturnValue({
      ...defaultState,
      solverSteps: magicSteps,
      currentStepIndex: 1,
    })
    rerender(<SolverStepsPanel />)

    expect(await screen.findByText('Technique used: Magic.')).toBeInTheDocument()
  })

  it('does not call viewSolverStep when an accordion item is closed', async () => {
    const user = userEvent.setup()
    // Start with an item open
    mockUseSudokuState.mockReturnValue({ ...defaultState, currentStepIndex: 1 })
    render(<SolverStepsPanel />)

    mockViewSolverStep.mockClear()

    // Click the already-open trigger to close it
    const step1Button = screen.getByRole('button', { name: /Step 1: NakedSingle/ })
    await user.click(step1Button)

    // No new action should have been called
    expect(mockViewSolverStep).not.toHaveBeenCalled()
  })
})
