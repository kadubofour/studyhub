// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSidebarCollapsed, SIDEBAR_COOKIE } from '@/lib/ui/sidebarPref'

beforeEach(() => { document.cookie = `${SIDEBAR_COOKIE}=; max-age=0; path=/` })

describe('useSidebarCollapsed', () => {
  it('starts from the value the server read from the cookie (so there is no flash on reload)', () => {
    const { result } = renderHook(() => useSidebarCollapsed(true))
    expect(result.current[0]).toBe(true)
  })
  it('remembers a change in a cookie the server can read next time', () => {
    const { result } = renderHook(() => useSidebarCollapsed(false))
    act(() => result.current[1](true))
    expect(result.current[0]).toBe(true)
    expect(document.cookie).toContain(`${SIDEBAR_COOKIE}=1`)
    act(() => result.current[1](false))
    expect(document.cookie).toContain(`${SIDEBAR_COOKIE}=0`)
  })
})
