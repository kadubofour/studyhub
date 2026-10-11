// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, cleanup } from '@testing-library/react'

let rows: unknown[] = []
let fails = false
const seen: string[] = []
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/activity', () => ({ loadActivity: async (_sb: unknown, tz: string) => { seen.push(tz); if (fails) throw new Error('bad zone'); return rows } }))
vi.mock('@/components/providers/ProfileProvider', () => ({ useProfile: () => ({ profile: { timezone: 'Africa/Accra' } }) }))
import { useXp } from '@/components/xp/useXp'

beforeEach(() => { rows = []; fails = false; seen.length = 0 })
afterEach(cleanup)

describe('useXp', () => {
  it('is empty until loaded, then a level 1 summary for a new student, using the profile time zone', async () => {
    const { result } = renderHook(() => useXp())
    expect(result.current.xp).toBeNull()
    await waitFor(() => expect(result.current.xp).not.toBeNull())
    expect(result.current.xp!.level.level).toBe(1)
    expect(seen).toEqual(['Africa/Accra'])
  })
  it('stays empty when loading fails', async () => {
    fails = true
    const { result } = renderHook(() => useXp())
    await waitFor(() => expect(seen).toHaveLength(1))
    expect(result.current.xp).toBeNull()
  })
})
