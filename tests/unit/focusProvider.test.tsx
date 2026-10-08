// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { useEffect } from 'react'
import type { Profile } from '@/lib/types'

const logFocusSession = vi.fn<(sb: unknown, session: { minutes: number; completed: boolean }) => Promise<void>>().mockResolvedValue(undefined)
vi.mock('@/lib/data/focus', () => ({
  logFocusSession: (sb: unknown, session: { minutes: number; completed: boolean }) => logFocusSession(sb, session),
  listSessionsSince: async () => [],
}))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))

import { ProfileProvider } from '@/components/providers/ProfileProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'
import { FocusProvider, useFocus } from '@/components/providers/FocusProvider'

const profile: Profile = {
  id: 'u', display_name: 'Ama', timezone: 'UTC', daily_goal_minutes: 120, focus_minutes: 1,
  short_break_minutes: 5, long_break_minutes: 15, long_break_every: 4, default_editor_mode: 'rich',
  theme: 'system', accent: 'blue', font: 'sans', look: 'classic', auto_math: true, onboarded: true,
}

// Stands in for "the user started focus, then went to another page": nothing renders the Focus page.
function StartOnMount() {
  const { toggle } = useFocus()
  useEffect(() => { toggle() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

beforeEach(() => {
  window.localStorage.clear()
  logFocusSession.mockClear()
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'] })
  vi.setSystemTime(new Date('2026-10-02T10:00:00Z'))
})
afterEach(() => { vi.useRealTimers() })

let api: ReturnType<typeof useFocus> | null = null
function Grab({ onApi }: { onApi: (v: ReturnType<typeof useFocus>) => void }) {
  const v = useFocus()
  useEffect(() => { onApi(v) })
  return null
}

describe('FocusProvider mode tabs', () => {
  it('clicking the mode that is already running does not reset the session', async () => {
    render(
      <ProfileProvider initial={profile}>
        <ToastProvider><FocusProvider><Grab onApi={v => { api = v }} /></FocusProvider></ToastProvider>
      </ProfileProvider>,
    )
    await act(async () => { api!.toggle() })
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
    const startedAt = api!.timer.startedAt
    expect(startedAt).not.toBeNull()
    await act(async () => { api!.pickMode('focus') })
    expect(api!.timer.startedAt).toBe(startedAt)
  })
})

describe('FocusProvider', () => {
  it('finishes and logs a session exactly once while the user is on another page', async () => {
    render(
      <ProfileProvider initial={profile}>
        <ToastProvider>
          <FocusProvider><StartOnMount /></FocusProvider>
        </ToastProvider>
      </ProfileProvider>,
    )
    await act(async () => { await vi.advanceTimersByTimeAsync(61_000) })
    await act(async () => { await vi.advanceTimersByTimeAsync(5 * 60_000) })
    expect(logFocusSession).toHaveBeenCalledTimes(1)
    expect(logFocusSession.mock.calls[0][1]).toMatchObject({ minutes: 1, completed: true })
  })
})
