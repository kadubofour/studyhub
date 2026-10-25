// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, cleanup, act } from '@testing-library/react'

let rows: unknown[] = []
let fails = false
let xpFails = false
let xpRows: unknown[] = []
const seen: string[] = []
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/activity', () => ({ loadActivity: async (_sb: unknown, tz: string) => { seen.push(tz); if (fails) throw new Error('bad zone'); return rows }, loadXpDays: async () => { if (xpFails) throw new Error('no server xp'); return xpRows } }))
vi.mock('@/components/providers/ProfileProvider', () => ({ useProfile: () => ({ profile: { timezone: 'Africa/Accra' } }) }))
import { useXp } from '@/components/xp/useXp'
import { announceProgressChanged } from '@/lib/xp/events'

beforeEach(() => { rows = []; xpRows = []; fails = false; xpFails = false; seen.length = 0 })
afterEach(cleanup)

describe('useXp', () => {
  it('is empty until loaded, then a level 1 summary for a new student, using the profile time zone', async () => {
    const { result } = renderHook(() => useXp())
    expect(result.current.xp).toBeNull()
    await waitFor(() => expect(result.current.xp).not.toBeNull())
    expect(result.current.xp!.level.level).toBe(1)
    expect(seen).toEqual(['Africa/Accra'])
  })
  it('takes XP from the server, and falls back to the activity rows if that fails', async () => {
    rows = [{ day: '2020-01-01', reviews: 7, quizzes: 0, focus_minutes: 0, tasks_done: 0, plan_sessions: 0, tutor_messages: 0, lectures: 0, games: 0 }]
    xpRows = [{ day: '2020-01-01', xp: 120 }]
    const a = renderHook(() => useXp())
    await waitFor(() => expect(a.result.current.xp).not.toBeNull())
    expect(a.result.current.xp!.total).toBe(120)
    xpFails = true
    const b = renderHook(() => useXp())
    await waitFor(() => expect(b.result.current.xp).not.toBeNull())
    expect(b.result.current.xp!.total).toBe(7)
  })
  it('reads again when something that earns XP says it was saved', async () => {
    const { result } = renderHook(() => useXp())
    await waitFor(() => expect(result.current.xp).not.toBeNull())
    expect(seen).toHaveLength(1)
    await act(async () => { announceProgressChanged() })
    await waitFor(() => expect(seen).toHaveLength(2))
  })
  it('stays empty when loading fails', async () => {
    fails = true
    const { result } = renderHook(() => useXp())
    await waitFor(() => expect(seen).toHaveLength(1))
    await act(async () => {})
    expect(result.current.xp).toBeNull()
  })
  it('goes back to empty when a later reload fails, and reloads when the key changes', async () => {
    const { result, rerender } = renderHook(({ k }) => useXp(k), { initialProps: { k: 0 } })
    await waitFor(() => expect(result.current.xp).not.toBeNull())
    fails = true
    await act(async () => { result.current.reload() })
    await waitFor(() => expect(result.current.xp).toBeNull())
    fails = false
    rerender({ k: 25 })
    await waitFor(() => expect(result.current.xp).not.toBeNull())
    expect(seen).toHaveLength(3)
  })
})
