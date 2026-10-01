import { describe, it, expect } from 'vitest'
import { schedule, formatInterval, previewIntervals, type SrsState, type Rating } from '@/lib/srs'

const now = new Date('2026-10-01T12:00:00Z')
const fresh: SrsState = { intervalDays: 0, ease: 2.5, reps: 0, lapses: 0, dueAt: now.toISOString() }
const DAY = 86_400_000

describe('schedule', () => {
  it('new card: Good → 1 day, Easy → 4 days, Hard → 1 day', () => {
    expect(schedule(fresh, 3, now).intervalDays).toBe(1)
    expect(schedule(fresh, 4, now).intervalDays).toBe(4)
    expect(schedule(fresh, 2, now).intervalDays).toBe(1)
  })
  it('second Good → 6 days, then interval × ease', () => {
    const s1 = schedule(fresh, 3, now)
    const s2 = schedule(s1, 3, now)
    expect(s2.intervalDays).toBe(6)
    const s3 = schedule(s2, 3, now)
    expect(s3.intervalDays).toBe(15) // round(6 * 2.5)
  })
  it('Again resets reps, counts a lapse only for learned cards, lowers ease, due in 1 minute', () => {
    const learned = schedule(schedule(fresh, 3, now), 3, now)
    const r = schedule(learned, 1, now)
    expect(r.reps).toBe(0)
    expect(r.lapses).toBe(1)
    expect(r.ease).toBe(2.3)
    expect(new Date(r.dueAt).getTime() - now.getTime()).toBe(60_000)
    expect(schedule(fresh, 1, now).lapses).toBe(0)
  })
  it('ease never drops below 1.3', () => {
    let s = fresh
    for (let i = 0; i < 20; i++) s = schedule(s, 1, now)
    expect(s.ease).toBe(1.3)
  })
  it('dueAt = now + intervalDays', () => {
    const s = schedule(fresh, 4, now)
    expect(new Date(s.dueAt).getTime()).toBe(now.getTime() + 4 * DAY)
  })
  it('keeps Hard ≤ Good < Easy for any learned state', () => {
    const states: SrsState[] = [
      { ...fresh, reps: 1, intervalDays: 1 },
      { ...fresh, reps: 2, intervalDays: 6 },
      { ...fresh, reps: 5, intervalDays: 40, ease: 1.3 },
      { ...fresh, reps: 3, intervalDays: 10, ease: 3.1 },
    ]
    for (const s of states) {
      const [h, g, e] = ([2, 3, 4] as Rating[]).map(r => schedule(s, r, now).intervalDays)
      expect(h).toBeLessThanOrEqual(g)
      expect(g).toBeLessThan(e)
    }
  })
})

describe('formatInterval / previewIntervals', () => {
  it('formats', () => {
    expect(formatInterval(30_000)).toBe('<1m')
    expect(formatInterval(60_000)).toBe('1m')
    expect(formatInterval(3 * 3_600_000)).toBe('3h')
    expect(formatInterval(6 * DAY)).toBe('6d')
    expect(formatInterval(62 * DAY)).toBe('2mo')
    expect(formatInterval(400 * DAY)).toBe('1y')
  })
  it('previews all four ratings', () => {
    expect(previewIntervals(fresh, now)).toEqual({ 1: '1m', 2: '1d', 3: '1d', 4: '4d' })
  })
})
