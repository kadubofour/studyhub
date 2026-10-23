import { describe, it, expect } from 'vitest'
import { describeRepeat, dueMine, nextOccurrence, occursOn, whenLabel, type MyReminder } from '@/lib/reminders/mine'

const TZ = 'Africa/Accra' // UTC+0 all year, so the times read plainly
const r = (over: Partial<MyReminder> = {}): MyReminder => ({ id: 'r1', title: 'Email my tutor', day: '2026-10-23', at: '16:00:00', repeat: 'once', ...over })
const at = (iso: string) => new Date(iso)

describe('occursOn', () => {
  it('a one-off is on its day only', () => {
    expect(occursOn(r(), '2026-10-23')).toBe(true)
    expect(occursOn(r(), '2026-10-24')).toBe(false)
  })
  it('every day is from its day on, never before', () => {
    expect(occursOn(r({ repeat: 'daily' }), '2026-10-22')).toBe(false)
    expect(occursOn(r({ repeat: 'daily' }), '2026-11-30')).toBe(true)
  })
  it('weekdays skips the weekend (23 Oct 2026 is a Friday)', () => {
    const w = r({ repeat: 'weekdays' })
    expect(['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26'].map(d => occursOn(w, d))).toEqual([true, false, false, true])
  })
  it('every week is the same weekday as its day', () => {
    const w = r({ repeat: 'weekly' })
    expect(['2026-10-30', '2026-10-31', '2026-11-06'].map(d => occursOn(w, d))).toEqual([true, false, true])
  })
})

describe('nextOccurrence', () => {
  it('is the time on its day while that is still ahead', () => {
    expect(nextOccurrence(r(), at('2026-10-23T10:00:00Z'), TZ)?.toISOString()).toBe('2026-10-23T16:00:00.000Z')
  })
  it('is gone for a one-off once its time has passed', () => {
    expect(nextOccurrence(r(), at('2026-10-23T16:30:00Z'), TZ)).toBeNull()
  })
  it('moves a repeating one to its next day', () => {
    expect(nextOccurrence(r({ repeat: 'daily' }), at('2026-10-23T16:30:00Z'), TZ)?.toISOString()).toBe('2026-10-24T16:00:00.000Z')
    expect(nextOccurrence(r({ repeat: 'weekdays' }), at('2026-10-23T16:30:00Z'), TZ)?.toISOString()).toBe('2026-10-26T16:00:00.000Z')
    expect(nextOccurrence(r({ repeat: 'weekly' }), at('2026-10-23T16:30:00Z'), TZ)?.toISOString()).toBe('2026-10-30T16:00:00.000Z')
  })
  it('keeps the local time in a zone with daylight saving', () => {
    const london = r({ repeat: 'daily', at: '08:00:00', day: '2026-10-24' })
    expect(nextOccurrence(london, at('2026-10-24T09:00:00Z'), 'Europe/London')?.toISOString()).toBe('2026-10-25T08:00:00.000Z') // the clocks went back that night
  })
})

describe('dueMine', () => {
  it('shows a reminder in the 15 minutes after its time, once per day, with the Reminders page to open', () => {
    expect(dueMine([r()], at('2026-10-23T15:59:00Z'), TZ)).toEqual([])
    expect(dueMine([r()], at('2026-10-23T16:05:00Z'), TZ)).toEqual([{ key: 'custom:r1:2026-10-23:16:00', title: 'Reminder', body: 'Email my tutor', href: '/reminders' }])
    expect(dueMine([r()], at('2026-10-23T16:20:00Z'), TZ)).toEqual([])
  })
  it('catches one set just before midnight, a few minutes into the next day', () => {
    const late = r({ at: '23:55:00', repeat: 'daily' })
    expect(dueMine([late], at('2026-10-24T00:03:00Z'), TZ).map(x => x.key)).toEqual(['custom:r1:2026-10-23:23:55'])
  })
  it('a weekday reminder late on Friday still shows just after midnight, on Saturday', () => {
    expect(dueMine([r({ at: '23:55:00', repeat: 'weekdays' })], at('2026-10-24T00:03:00Z'), TZ).map(x => x.key)).toEqual(['custom:r1:2026-10-23:23:55'])
  })
  it('a time the clocks skip (London, 28 March 2027 01:30) still has a next time', () => {
    const skipped = r({ day: '2027-03-28', at: '01:30:00', repeat: 'daily' })
    expect(nextOccurrence(skipped, at('2027-03-27T12:00:00Z'), 'Europe/London')).not.toBeNull()
  })
  it('a moved time is a new moment, so it can show again', () => {
    const a = dueMine([r({ at: '16:00:00' })], at('2026-10-23T16:01:00Z'), TZ)[0].key
    const b = dueMine([r({ at: '17:00:00' })], at('2026-10-23T17:01:00Z'), TZ)[0].key
    expect(a).not.toBe(b)
  })
})

describe('words', () => {
  it('says how it repeats', () => {
    expect(['once', 'daily', 'weekdays', 'weekly'].map(repeat => describeRepeat(r({ repeat: repeat as MyReminder['repeat'] })))).toEqual(['Once', 'Every day', 'Weekdays', 'Every Friday'])
  })
  it('says when, plainly: today, tomorrow, or the date', () => {
    const now = at('2026-10-23T10:00:00Z')
    expect(whenLabel(at('2026-10-23T16:00:00Z'), TZ, now)).toBe('Today 16:00')
    expect(whenLabel(at('2026-10-24T08:00:00Z'), TZ, now)).toBe('Tomorrow 08:00')
    expect(whenLabel(at('2026-10-30T16:00:00Z'), TZ, now)).toBe('Fri 30 Oct 16:00')
  })
})
