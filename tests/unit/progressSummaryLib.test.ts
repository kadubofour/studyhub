import { describe, it, expect } from 'vitest'
import { compareWeeks, fmtCompact, fmtMinutes, headline, weekDots, weekTotals } from '@/lib/progress/summary'

// 2026-10-14 is a Wednesday
const TODAY = '2026-10-14'
const mins = (o: Record<string, number>) => new Map(Object.entries(o))
const base = { streak: 0, goalMinutes: 120, todayMinutes: 0, weekMinutes: 0, totalXp: 0 }

describe('fmtMinutes', () => {
  it('writes minutes, hours, and hours with minutes', () => {
    expect([0, 25, 60, 90, 120, 221].map(fmtMinutes)).toEqual(['0m', '25m', '1h', '1h 30m', '2h', '3h 41m'])
  })
})

describe('headline', () => {
  it('welcomes a student with nothing yet, without a zero in sight', () => {
    const h = headline(base)
    expect(h.title).toBe('Your first session starts it all.')
    expect(h.line).toMatch(/10 minutes/)
  })
  it('celebrates a goal reached, with the streak when there is one', () => {
    expect(headline({ ...base, streak: 4, todayMinutes: 130 })).toEqual({ title: 'Today\'s goal is done.', line: '4 days in a row. Nice work.' })
    expect(headline({ ...base, streak: 1, todayMinutes: 130 }).line).toMatch(/Come back tomorrow/)
  })
  it('tells a streak how to keep going, and how much of the goal is left', () => {
    expect(headline({ ...base, streak: 3 })).toEqual({ title: '3 days in a row. Keep it going.', line: 'A short focus session today keeps your streak alive.' })
    expect(headline({ ...base, streak: 3, todayMinutes: 45 }).line).toBe('1h 15m more of focus reaches today\'s goal.')
  })
  it('names day one of a streak', () => {
    expect(headline({ ...base, streak: 1 }).title).toBe('Day one of a streak.')
  })
  it('credits the week when there is no streak, and a made start when there is only XP', () => {
    expect(headline({ ...base, weekMinutes: 90 }).title).toBe('1h 30m of focus this week.')
    expect(headline({ ...base, totalXp: 25 }).title).toBe('You have made a start.')
  })
  it('does not call a goal reached when there is no goal', () => {
    expect(headline({ ...base, goalMinutes: 0, todayMinutes: 10 }).title).not.toBe('Today\'s goal is done.')
  })
})

describe('weekDots', () => {
  it('is Monday to Sunday, with each day met, partly done, empty or still to come', () => {
    const dots = weekDots(TODAY, mins({ '2026-10-12': 130, '2026-10-13': 20, '2026-10-14': 0 }), 120)
    expect(dots.map(d => d.letter).join('')).toBe('MTWTFSS')
    expect(dots.map(d => d.state)).toEqual(['met', 'some', 'none', 'future', 'future', 'future', 'future'])
    expect(dots.filter(d => d.isToday).map(d => d.name)).toEqual(['Wednesday'])
  })
})

describe('weekTotals', () => {
  it('totals each of the last weeks, oldest first, the last being this week so far', () => {
    const t = weekTotals(TODAY, mins({ '2026-10-05': 60, '2026-10-11': 30, '2026-10-12': 45, '2026-10-14': 15, '2026-10-16': 999 }), 3)
    expect(t.map(w => w.minutes)).toEqual([0, 90, 60]) // a day after today does not count
    expect(t.map(w => w.label)).toEqual(['28 Sep', '5 Oct', '12 Oct'])
    expect(t.map(w => w.current)).toEqual([false, false, true])
  })
})

describe('compareWeeks', () => {
  it('celebrates more, and only shows last week\'s number when it is less', () => {
    expect(compareWeeks(0, 0)).toBe('Nothing yet this week')
    expect(compareWeeks(30, 0)).toBe('A fresh start this week')
    expect(compareWeeks(150, 90)).toBe('1h more than last week')
    expect(compareWeeks(90, 90)).toBe('The same as last week')
    expect(compareWeeks(30, 90)).toBe('Last week: 1h 30m')
  })
})

describe('headline without a goal', () => {
  it('never says how much of a goal is left', () => {
    expect(headline({ ...base, goalMinutes: 0, streak: 3, todayMinutes: 10 }).line).toBe('A short focus session today keeps your streak alive.')
  })
})

describe('fmtCompact', () => {
  it('is short enough to sit above a bar', () => {
    expect([0, 53, 60, 105, 120, 224].map(fmtCompact)).toEqual(['0m', '53m', '1h', '1.8h', '2h', '3.7h'])
  })
})
