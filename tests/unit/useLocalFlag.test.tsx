// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLocalFlag } from '@/lib/ui/useLocalFlag'

beforeEach(() => window.localStorage.clear())

describe('useLocalFlag', () => {
  it('starts false, toggles, and remembers the value on this device', () => {
    const { result, unmount } = renderHook(() => useLocalFlag('studyhub.sidebar-collapsed'))
    expect(result.current[0]).toBe(false)
    act(() => result.current[1](true))
    expect(result.current[0]).toBe(true)
    unmount()
    const again = renderHook(() => useLocalFlag('studyhub.sidebar-collapsed'))
    expect(again.result.current[0]).toBe(true)
  })
  it('keeps two components using the same flag in sync', () => {
    const a = renderHook(() => useLocalFlag('k'))
    const b = renderHook(() => useLocalFlag('k'))
    act(() => a.result.current[1](true))
    expect(b.result.current[0]).toBe(true)
  })
})
