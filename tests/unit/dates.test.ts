import { describe, it, expect } from 'vitest'
import {
  localDayKey, endOfLocalDay, startOfLocalDay, addDaysToKey, weekdayOfKey,
  bucketTasks, formatDue, weekKeysFor, localTimeHHMM,
} from '@/lib/dates'

const NY = 'America/New_York'
const t = (id: string, due_at: string | null, done_at: string | null = null) => ({ id, due_at, done_at })

describe('localDayKey', () => {
  it('uses the local date, not UTC', () => {
    // 03:30 UTC on Oct 1 is 23:30 on Sep 30 in New York
    expect(localDayKey('2026-10-01T03:30:00Z', NY)).toBe('2026-09-30')
    expect(localDayKey('2026-10-01T03:30:00Z', 'UTC')).toBe('2026-10-01')
  })
})

describe('day boundaries', () => {
  it('endOfLocalDay handles DST end (US: Nov 1 2026)', () => {
    expect(endOfLocalDay('2026-11-01', NY).toISOString()).toBe('2026-11-02T04:59:59.000Z')
    expect(endOfLocalDay('2026-10-31', NY).toISOString()).toBe('2026-11-01T03:59:59.000Z')
  })
  it('startOfLocalDay', () => {
    expect(startOfLocalDay('2026-10-01', NY).toISOString()).toBe('2026-10-01T04:00:00.000Z')
  })
  it('addDaysToKey crosses months, years and DST', () => {
    expect(addDaysToKey('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysToKey('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDaysToKey('2026-11-01', 1)).toBe('2026-11-02')
  })
  it('weekdayOfKey', () => {
    expect(weekdayOfKey('2026-10-01')).toBe(4) // Thursday
    expect(weekdayOfKey('2026-10-04')).toBe(0) // Sunday
  })
  it('localTimeHHMM', () => {
    expect(localTimeHHMM(new Date('2026-10-01T14:05:00Z'), NY)).toBe('10:05')
  })
})

describe('bucketTasks', () => {
  const now = new Date('2026-10-01T03:30:00Z') // Sep 30, 23:30 in NY
  it('puts a task due later the same local evening in today, even though UTC is already the next day', () => {
    const r = bucketTasks([t('a', '2026-10-01T03:45:00Z')], NY, now)
    expect(r.today.map(x => x.id)).toEqual(['a'])
  })
  it('splits overdue / today / upcoming / noDate and skips done tasks', () => {
    const r = bucketTasks([
      t('late', '2026-09-29T15:00:00Z'),
      t('today', '2026-09-30T20:00:00Z'),
      t('tomorrow', '2026-10-01T05:00:00Z'),
      t('none', null),
      t('done', '2026-09-29T15:00:00Z', '2026-09-29T16:00:00Z'),
    ], NY, now)
    expect(r.overdue.map(x => x.id)).toEqual(['late'])
    expect(r.today.map(x => x.id)).toEqual(['today'])
    expect(r.upcoming.map(x => x.id)).toEqual(['tomorrow'])
    expect(r.noDate.map(x => x.id)).toEqual(['none'])
  })
  it('sorts each bucket by due date', () => {
    const r = bucketTasks([t('b', '2026-10-05T12:00:00Z'), t('a', '2026-10-03T12:00:00Z')], NY, now)
    expect(r.upcoming.map(x => x.id)).toEqual(['a', 'b'])
  })
})

describe('formatDue', () => {
  const now = new Date('2026-10-01T14:00:00Z') // Thu Oct 1, 10:00 NY
  it('labels today, tomorrow, this week, later', () => {
    expect(formatDue('2026-10-02T03:59:00Z', NY, now)).toBe('Today')
    expect(formatDue('2026-10-02T15:00:00Z', NY, now)).toBe('Tomorrow')
    expect(formatDue('2026-10-05T15:00:00Z', NY, now)).toBe('Mon')
    expect(formatDue('2026-10-09T15:00:00Z', NY, now)).toBe('Oct 9')
    expect(formatDue('2026-09-29T15:00:00Z', NY, now)).toBe('Sep 29')
  })
})

describe('weekKeysFor', () => {
  it('returns Monday..Sunday containing the day', () => {
    expect(weekKeysFor('2026-10-01')).toEqual([
      '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
    ])
    expect(weekKeysFor('2026-10-04')[0]).toBe('2026-09-28') // Sunday belongs to the week starting Monday before
  })
})
