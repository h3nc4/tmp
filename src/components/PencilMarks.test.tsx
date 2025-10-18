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
import { describe, expect, it } from 'vitest'
import { PencilMarks } from './PencilMarks'

describe('PencilMarks component', () => {
  it('renders nothing when both sets are empty', () => {
    const { container } = render(
      <PencilMarks
        candidates={new Set()}
        centers={new Set()}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders candidate marks correctly', () => {
    render(
      <PencilMarks
        candidates={new Set([1, 5, 9])}
        centers={new Set()}
      />,
    )
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('9')).toBeInTheDocument()
    expect(screen.queryByText('2')).not.toBeInTheDocument()
  })

  it('renders center marks correctly and gives them priority', () => {
    render(
      <PencilMarks
        candidates={new Set([1, 2])}
        centers={new Set([7, 8])}
      />,
    )
    // Should render center marks
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    // Should NOT render candidate marks
    expect(screen.queryByText('1')).not.toBeInTheDocument()
    expect(screen.queryByText('2')).not.toBeInTheDocument()
  })

  it('renders small font for many center marks', () => {
    const { container } = render(
      <PencilMarks
        candidates={new Set()}
        centers={new Set([1, 2, 3, 4, 5])}
      />,
    )
    const span = container.querySelector('span')
    expect(span).toHaveClass('text-[0.6rem]')
  })

  it('renders normal font for few center marks', () => {
    const { container } = render(
      <PencilMarks
        candidates={new Set()}
        centers={new Set([1, 2, 3])}
      />,
    )
    const span = container.querySelector('span')
    expect(span).toHaveClass('text-xs')
  })

  it('renders eliminated candidates with a line-through style', () => {
    render(
      <PencilMarks
        candidates={new Set([1, 2, 3])}
        centers={new Set()}
        eliminations={new Set([2])}
      />,
    )
    const eliminatedMark = screen.getByText('2')
    expect(eliminatedMark).toHaveClass('line-through')
    expect(screen.getByText('1')).not.toHaveClass('line-through')
    expect(screen.getByText('3')).not.toHaveClass('line-through')
  })
})
