import { describe, it, expect } from 'vitest'
import { computeStreak, dailyMinutes } from '@/lib/streak'

const tz = 'UTC'
const s = (day: string, minutes: number) => ({ started_at: `${day}T10:00:00Z`, minutes })
const now = new Date('2026-10-10T15:00:00Z')

describe('dailyMinutes', () => {
  it('sums by local day', () => {
    const m = dailyMinutes([s('2026-10-09', 25), s('2026-10-09', 30), s('2026-10-10', 10)], tz)
    expect(m.get('2026-10-09')).toBe(55)
    expect(m.get('2026-10-10')).toBe(10)
  })
  it('attributes by the user timezone', () => {
    // 02:00Z on Oct 10 is Oct 9 in New York
    const m = dailyMinutes([{ started_at: '2026-10-10T02:00:00Z', minutes: 25 }], 'America/New_York')
    expect(m.get('2026-10-09')).toBe(25)
  })
})

describe('computeStreak', () => {
  it('counts consecutive goal-met days ending today', () => {
    const r = computeStreak([s('2026-10-08', 60), s('2026-10-09', 60), s('2026-10-10', 60)], 60, tz, now)
    expect(r.current).toBe(3)
  })
  it('does not break the streak just because today is not met yet', () => {
    const r = computeStreak([s('2026-10-08', 60), s('2026-10-09', 60), s('2026-10-10', 10)], 60, tz, now)
    expect(r.current).toBe(2)
  })
  it('is 0 when yesterday was missed and today not met', () => {
    expect(computeStreak([s('2026-10-08', 60)], 60, tz, now).current).toBe(0)
  })
  it('sums multiple sessions toward the goal', () => {
    expect(computeStreak([s('2026-10-10', 30), s('2026-10-10', 30)], 60, tz, now).current).toBe(1)
  })
  it('computes best streak across gaps', () => {
    const r = computeStreak([
      s('2026-09-01', 60), s('2026-09-02', 60), s('2026-09-03', 60), s('2026-09-04', 60),
      s('2026-10-10', 60),
    ], 60, tz, now)
    expect(r.best).toBe(4)
    expect(r.current).toBe(1)
  })
  it('treats a goal of 0 as 1 minute', () => {
    expect(computeStreak([s('2026-10-10', 1)], 0, tz, now).current).toBe(1)
  })
  it('handles no sessions', () => {
    expect(computeStreak([], 60, tz, now)).toEqual({ current: 0, best: 0 })
  })
})
