import { describe, it, expect } from 'vitest'
import { loadTimer, saveTimer } from '@/lib/ui/timerStore'
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
  it('returns null for missing or corrupt data', () => {
    const s = memory()
    expect(loadTimer(s)).toBeNull()
    s.setItem('studyhub.timer', '{not json')
    expect(loadTimer(s)).toBeNull()
    s.setItem('studyhub.timer', JSON.stringify({ state: { mode: 'nap' } }))
    expect(loadTimer(s)).toBeNull()
  })
})
