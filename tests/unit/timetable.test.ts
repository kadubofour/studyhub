import { describe, it, expect } from 'vitest'
import { classChip, nextClass } from '@/lib/timetable'

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

describe('classChip', () => {
  // Thu Oct 1 2026, 10:00 in New York (day_of_week 4)
  const now = new Date('2026-10-01T14:00:00Z')
  const slot = (id: string, course_id: string, day_of_week: number, start_time: string, end_time: string) => ({ id, course_id, day_of_week, start_time, end_time })
  const courses = [{ id: 'bio', name: 'Biology' }, { id: 'chem', name: 'Chemistry' }]
  it('says which class is on now and until when', () => {
    expect(classChip([slot('a', 'bio', 4, '09:30:00', '10:30:00')], courses, NY, now)).toEqual({ label: 'Biology · till 10:30', short: 'till 10:30' })
  })
  it('says the next class today and when it starts', () => {
    expect(classChip([slot('a', 'bio', 4, '09:00:00', '09:50:00'), slot('b', 'chem', 4, '14:00:00', '15:00:00')], courses, NY, now)).toEqual({ label: 'Chemistry · 14:00', short: '14:00' })
  })
  it('is nothing when no class is left today', () => {
    expect(classChip([slot('a', 'bio', 4, '08:00:00', '09:00:00'), slot('b', 'bio', 5, '08:00:00', '09:00:00')], courses, NY, now)).toBeNull()
    expect(classChip([], courses, NY, now)).toBeNull()
  })
  it('the end minute is already over', () => {
    expect(classChip([slot('a', 'bio', 4, '09:00:00', '10:00:00')], courses, NY, now)).toBeNull()
  })
  it('names a class whose course is unknown plainly', () => {
    expect(classChip([slot('a', 'gone', 4, '11:00:00', '12:00:00')], courses, NY, now)).toEqual({ label: 'Class · 11:00', short: '11:00' })
  })
})
