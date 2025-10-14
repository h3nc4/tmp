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
import { useTheme } from 'next-themes'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ModeToggle } from './mode-toggle'

// Mock the 'next-themes' hook
vi.mock('next-themes', () => ({
  useTheme: vi.fn(),
}))

describe('ModeToggle component', () => {
  const mockSetTheme = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('toggles from light to dark mode when clicked', async () => {
    const user = userEvent.setup()
    vi.mocked(useTheme).mockReturnValue({
      theme: 'light',
      setTheme: mockSetTheme,
      themes: ['light', 'dark'],
    })

    render(<ModeToggle />)
    const toggleButton = screen.getByRole('button', { name: /toggle theme/i })
    await user.click(toggleButton)

    expect(mockSetTheme).toHaveBeenCalledWith('dark')
  })

  it('toggles from dark to light mode when clicked', async () => {
    const user = userEvent.setup()
    vi.mocked(useTheme).mockReturnValue({
      theme: 'dark',
      setTheme: mockSetTheme,
      themes: ['light', 'dark'],
    })

    render(<ModeToggle />)
    const toggleButton = screen.getByRole('button', { name: /toggle theme/i })
    await user.click(toggleButton)

    expect(mockSetTheme).toHaveBeenCalledWith('light')
  })
})
