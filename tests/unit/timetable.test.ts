import { describe, it, expect } from 'vitest'
import { nextClass } from '@/lib/timetable'

const NY = 'America/New_York'
const c = (id: string, day_of_week: number, start_time: string) => ({ id, day_of_week, start_time })

describe('nextClass', () => {
  // Thu Oct 1 2026, 10:00 in New York
  const now = new Date('2026-10-01T14:00:00Z')
  it('returns a later class today', () => {
    const r = nextClass([c('a', 4, '09:00:00'), c('b', 4, '13:00:00')], NY, now)
    expect(r?.cls.id).toBe('b')
    expect(r?.dayKey).toBe('2026-10-01')
  })
  it('skips classes that already started today and finds the next day', () => {
    const r = nextClass([c('a', 4, '09:00:00'), c('fri', 5, '08:00:00')], NY, now)
    expect(r?.cls.id).toBe('fri')
    expect(r?.dayKey).toBe('2026-10-02')
  })
  it('wraps to next week for the same weekday', () => {
    const r = nextClass([c('a', 4, '09:00:00')], NY, now)
    expect(r?.dayKey).toBe('2026-10-08')
  })
  it('returns null with no classes', () => {
    expect(nextClass([], NY, now)).toBeNull()
  })
})
