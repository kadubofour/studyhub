import { describe, it, expect } from 'vitest'
import { monthKeys, rangeTitle, shiftAnchor, visibleKeys } from '@/lib/calendar/range'

describe('visibleKeys', () => {
  it('is the day itself in Day view', () => { expect(visibleKeys('day', '2026-10-14')).toEqual(['2026-10-14']) })
  it('is Monday to Sunday in Week view', () => {
    expect(visibleKeys('week', '2026-10-14')).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'])
  })
  it('is whole Monday weeks around the month in Month view', () => {
    const k = visibleKeys('month', '2026-10-14')
    expect(k[0]).toBe('2026-09-28') // Oct 1 2026 is a Thursday
    expect(k[k.length - 1]).toBe('2026-11-01')
    expect(k).toHaveLength(35)
  })
})

describe('monthKeys', () => {
  it('has six rows when the month needs them', () => {
    // March 2026 starts on a Sunday and has 31 days: Feb 23 to Apr 5
    const k = monthKeys('2026-03-10')
    expect(k[0]).toBe('2026-02-23')
    expect(k[k.length - 1]).toBe('2026-04-05')
    expect(k).toHaveLength(42)
  })
  it('has four rows for a February that starts on a Monday', () => {
    const k = monthKeys('2027-02-10') // Feb 1 2027 is a Monday, 28 days
    expect(k[0]).toBe('2027-02-01')
    expect(k[k.length - 1]).toBe('2027-02-28')
    expect(k).toHaveLength(28)
  })
})

describe('shiftAnchor', () => {
  it('moves a day, a week or a month', () => {
    expect(shiftAnchor('day', '2026-10-14', 1)).toBe('2026-10-15')
    expect(shiftAnchor('day', '2026-10-01', -1)).toBe('2026-09-30')
    expect(shiftAnchor('week', '2026-10-14', 1)).toBe('2026-10-21')
    expect(shiftAnchor('month', '2026-10-14', 1)).toBe('2026-11-14')
    expect(shiftAnchor('month', '2026-12-14', 1)).toBe('2027-01-14')
    expect(shiftAnchor('month', '2026-01-14', -1)).toBe('2025-12-14')
  })
  it('keeps a month end inside the shorter month', () => {
    expect(shiftAnchor('month', '2026-01-31', 1)).toBe('2026-02-28')
    expect(shiftAnchor('month', '2026-03-31', -1)).toBe('2026-02-28')
    expect(shiftAnchor('month', '2028-01-31', 1)).toBe('2028-02-29')
  })
})

describe('rangeTitle', () => {
  it('names the day, the week or the month', () => {
    expect(rangeTitle('day', '2026-10-12')).toBe('Monday, Oct 12, 2026')
    expect(rangeTitle('week', '2026-10-14')).toBe('Oct 12 – 18, 2026')
    expect(rangeTitle('month', '2026-10-14')).toBe('October 2026')
  })
  it('shows both months when a week crosses one, and both years when it crosses New Year', () => {
    expect(rangeTitle('week', '2026-10-28')).toBe('Oct 26 – Nov 1, 2026')
    expect(rangeTitle('week', '2026-12-30')).toBe('Dec 28, 2026 – Jan 3, 2027')
  })
})
