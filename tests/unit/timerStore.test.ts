import { describe, it, expect } from 'vitest'
import { clearTimer, loadTimer, saveTimer } from '@/lib/ui/timerStore'
import { createTimer } from '@/lib/timer'

function memory() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) } }
}

describe('timerStore', () => {
  it('round-trips state so a reload keeps the running timer', () => {
    const s = memory()
    const t = { state: { ...createTimer('focus', 1500_000), startedAt: 123, firstStartedAt: 123 }, completedFocus: 2, dayKey: '2026-10-01' }
    saveTimer(s, t)
    expect(loadTimer(s)).toEqual(t)
  })
  it('keeps each user\'s timer separate (shared devices)', () => {
    const s = memory()
    const t = { state: createTimer('focus', 1500_000), completedFocus: 1, dayKey: '2026-10-01' }
    saveTimer(s, t, 'user-a')
    expect(loadTimer(s, 'user-b')).toBeNull()
    expect(loadTimer(s, 'user-a')).toEqual(t)
  })
  it('clearTimer removes a user\'s saved timer', () => {
    const s = { ...memory(), removed: [] as string[] }
    const store = { getItem: s.getItem, setItem: s.setItem, removeItem: (k: string) => { s.removed.push(k); s.setItem(k, '') } }
    saveTimer(store, { state: createTimer('focus', 1), completedFocus: 0, dayKey: 'x' }, 'user-a')
    clearTimer(store, 'user-a')
    expect(loadTimer(store, 'user-a')).toBeNull()
  })
  it('returns null for missing or corrupt data', () => {
    const s = memory()
    expect(loadTimer(s)).toBeNull()
    s.setItem('studyhub.timer', '{not json')
    expect(loadTimer(s)).toBeNull()
    s.setItem('studyhub.timer', JSON.stringify({ state: { mode: 'nap' } }))
    expect(loadTimer(s)).toBeNull()
  })
})
