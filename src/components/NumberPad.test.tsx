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
import { describe, expect, it, vi } from 'vitest'
import { NumberPad } from './NumberPad'

describe('NumberPad component', () => {
  const mockOnNumberClick = vi.fn()

  it('renders 9 number buttons', () => {
    render(<NumberPad onNumberClick={mockOnNumberClick} disabled={false} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(9)
    expect(
      screen.getByRole('button', { name: 'Enter number 1' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Enter number 9' }),
    ).toBeInTheDocument()
  })

  it('calls onNumberClick with the correct value when a button is clicked', async () => {
    const user = userEvent.setup()
    render(<NumberPad onNumberClick={mockOnNumberClick} disabled={false} />)

    const button5 = screen.getByRole('button', { name: 'Enter number 5' })
    await user.click(button5)

    expect(mockOnNumberClick).toHaveBeenCalledWith(5)
    expect(mockOnNumberClick).toHaveBeenCalledTimes(1)
  })

  it('disables all buttons when the disabled prop is true', () => {
    render(<NumberPad onNumberClick={mockOnNumberClick} disabled={true} />)
    const buttons = screen.getAllByRole('button')
    buttons.forEach((button) => {
      expect(button).toBeDisabled()
    })
  })
})
