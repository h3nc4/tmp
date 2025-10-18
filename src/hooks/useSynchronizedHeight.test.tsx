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

import { render, act } from '@testing-library/react'
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from 'vitest'
import { useSynchronizedHeight } from './useSynchronizedHeight'

// Mock for ResizeObserver
let mockResizeObserverCallback: ResizeObserverCallback | null = null
const mockDisconnect = vi.fn()
const mockObserve = vi.fn()

const ResizeObserverMock = vi.fn((callback) => {
  mockResizeObserverCallback = callback
  return {
    observe: mockObserve,
    unobserve: vi.fn(),
    disconnect: mockDisconnect,
  }
})

describe('useSynchronizedHeight', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    mockResizeObserverCallback = null
    mockDisconnect.mockClear()
    mockObserve.mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // A test component to attach refs to actual DOM nodes, letting React handle the lifecycle.
  const TestComponent = ({ isEnabled }: { isEnabled: boolean }) => {
    const { sourceRef, targetRef } = useSynchronizedHeight(isEnabled)
    return (
      <>
        <div ref={sourceRef} data-testid="source" />
        <div ref={targetRef} data-testid="target" />
      </>
    )
  }

  it('should not apply height or observe if isEnabled is false', () => {
    const { getByTestId } = render(<TestComponent isEnabled={false} />)
    const target = getByTestId('target')

    expect(target.style.height).toBe('')
    expect(mockObserve).not.toHaveBeenCalled()
  })

  it('should synchronize height when isEnabled is true and refs are attached', () => {
    // Start with the component disabled so the effect doesn't run initially.
    const { getByTestId, rerender } = render(<TestComponent isEnabled={false} />)
    const source = getByTestId('source')
    const target = getByTestId('target')

    // Mock the height of the source element.
    Object.defineProperty(source, 'offsetHeight', {
      configurable: true,
      value: 500,
    })

    // Now, enable the hook by re-rendering. This will trigger the useLayoutEffect.
    rerender(<TestComponent isEnabled={true} />)

    expect(target.style.height).toBe('500px')
    expect(mockObserve).toHaveBeenCalledWith(source)
  })

  it('should update height when ResizeObserver is triggered', () => {
    const { getByTestId, rerender } = render(<TestComponent isEnabled={false} />)
    const source = getByTestId('source')
    const target = getByTestId('target')

    // Set initial height and enable the hook
    Object.defineProperty(source, 'offsetHeight', {
      configurable: true,
      value: 500,
    })
    rerender(<TestComponent isEnabled={true} />)
    expect(target.style.height).toBe('500px')

    // Simulate a resize by changing the mocked height
    Object.defineProperty(source, 'offsetHeight', {
      configurable: true,
      value: 600,
    })

    // Manually trigger the observer's callback
    act(() => {
      mockResizeObserverCallback?.([], {} as ResizeObserver)
    })

    expect(target.style.height).toBe('600px')
  })

  it('should disconnect the observer on unmount', () => {
    // Render enabled to ensure the observer is set up
    const { unmount } = render(<TestComponent isEnabled={true} />)
    // The effect runs, observer is created and attached
    expect(mockObserve).toHaveBeenCalledOnce()

    unmount()
    expect(mockDisconnect).toHaveBeenCalledOnce()
  })

  it('should reset the height when the hook is disabled', () => {
    const { getByTestId, rerender } = render(<TestComponent isEnabled={false} />)
    const source = getByTestId('source')
    const target = getByTestId('target')

    // Set initial height and enable the hook
    Object.defineProperty(source, 'offsetHeight', {
      configurable: true,
      value: 500,
    })
    rerender(<TestComponent isEnabled={true} />)
    expect(target.style.height).toBe('500px')

    // Now disable the hook by re-rendering with a new prop
    rerender(<TestComponent isEnabled={false} />)

    // The cleanup function from the effect should have run and cleared the style
    expect(target.style.height).toBe('')
    expect(mockDisconnect).toHaveBeenCalledOnce()
  })
})
