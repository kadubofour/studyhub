// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { StrictMode, createElement, type ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { usePersistedTimer } from '@/lib/ui/usePersistedTimer'
import { createTimer, startTimer } from '@/lib/timer'
import { localDayKey } from '@/lib/dates'

const strict = ({ children }: { children: ReactNode }) => createElement(StrictMode, null, children)
const KEY = 'studyhub.timer'

beforeEach(() => { window.localStorage.clear() })

describe('usePersistedTimer', () => {
  it('restores a running timer after reload, even under StrictMode double effects', async () => {
    const running = startTimer(createTimer('focus', 25 * 60_000), Date.now() - 60_000)
    const today = localDayKey(new Date(), 'UTC')
    window.localStorage.setItem(KEY, JSON.stringify({ state: running, completedFocus: 2, dayKey: today }))

    const { result } = renderHook(() => usePersistedTimer(() => createTimer('focus', 25 * 60_000), 'UTC'), { wrapper: strict })

    await waitFor(() => expect(result.current.timer.startedAt).toBe(running.startedAt))
    expect(result.current.completedFocus).toBe(2)
    expect(JSON.parse(window.localStorage.getItem(KEY)!).state.startedAt).toBe(running.startedAt)
  })

  it('never overwrites a saved timer with the fresh initial state while restoring', async () => {
    const running = startTimer(createTimer('focus', 25 * 60_000), Date.now() - 60_000)
    window.localStorage.setItem(KEY, JSON.stringify({ state: running, completedFocus: 0, dayKey: localDayKey(new Date(), 'UTC') }))
    const writes: string[] = []
    const orig = Storage.prototype.setItem
    Storage.prototype.setItem = function (k: string, v: string) { if (k === KEY) writes.push(v); return orig.call(this, k, v) }
    try {
      const { result } = renderHook(() => usePersistedTimer(() => createTimer('focus', 25 * 60_000), 'UTC'), { wrapper: strict })
      await waitFor(() => expect(result.current.timer.startedAt).toBe(running.startedAt))
    } finally {
      Storage.prototype.setItem = orig
    }
    // If the page is torn down mid-restore (e.g. React regenerating the tree), the stored value
    // must still be the running timer, so no write may ever contain the un-restored fresh state.
    expect(writes.map(w => JSON.parse(w).state.startedAt)).not.toContain(null)
  })

  it('resets the cycle count on a new day but keeps the timer', async () => {
    const t = startTimer(createTimer('focus', 25 * 60_000), Date.now())
    window.localStorage.setItem(KEY, JSON.stringify({ state: t, completedFocus: 3, dayKey: '2000-01-01' }))
    const { result } = renderHook(() => usePersistedTimer(() => createTimer('focus', 25 * 60_000), 'UTC'), { wrapper: strict })
    await waitFor(() => expect(result.current.timer.startedAt).toBe(t.startedAt))
    expect(result.current.completedFocus).toBe(0)
  })

  it('starts fresh with nothing saved, and saves changes', async () => {
    const { result } = renderHook(() => usePersistedTimer(() => createTimer('short', 5 * 60_000), 'UTC'), { wrapper: strict })
    await waitFor(() => expect(window.localStorage.getItem(KEY)).not.toBeNull())
    expect(result.current.timer.mode).toBe('short')
    expect(JSON.parse(window.localStorage.getItem(KEY)!).state.mode).toBe('short')
  })
})
