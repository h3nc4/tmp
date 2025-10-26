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

import { useRef, useLayoutEffect } from 'react'

/**
 * Synchronizes the height of a target element to match a source element.
 * It uses a ResizeObserver to automatically update when the source's size changes.
 *
 * @param isEnabled - A boolean to enable or disable the synchronization effect.
 * @returns An object with `sourceRef` and `targetRef` to attach to DOM elements.
 */
export function useSynchronizedHeight(isEnabled: boolean) {
  const sourceRef = useRef<HTMLDivElement>(null)
  const targetRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const sourceEl = sourceRef.current
    const targetEl = targetRef.current

    if (isEnabled && sourceEl && targetEl) {
      const setTargetHeight = () => {
        targetEl.style.height = `${sourceEl.offsetHeight}px`
      }

      // Initial sync after layout calculation.
      setTargetHeight()

      // Observe the source element for size changes.
      const resizeObserver = new ResizeObserver(setTargetHeight)
      resizeObserver.observe(sourceEl)

      // Cleanup: disconnect the observer and remove the inline style.
      return () => {
        resizeObserver.disconnect()
        targetEl.style.height = ''
      }
    }
  }, [isEnabled])

  return { sourceRef, targetRef }
}
