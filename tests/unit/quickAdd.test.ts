import { describe, it, expect } from 'vitest'
import { parseQuickAdd } from '@/lib/quickAdd'

const NY = 'America/New_York'
const now = new Date('2026-10-01T14:00:00Z') // Thu Oct 1 2026, 10:00 NY
const eod = (key: string) => {
  // 23:59:59 EDT = 03:59:59Z next day (before Nov 1)
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1, 3, 59, 59)).toISOString()
}

describe('parseQuickAdd', () => {
  it('parses a trailing weekday abbreviation', () => {
    expect(parseQuickAdd('Calc problem set fri', NY, now)).toEqual({ title: 'Calc problem set', dueAt: eod('2026-10-02') })
  })
  it('parses full weekday names and prefixes like "tues"', () => {
    expect(parseQuickAdd('Essay monday', NY, now).dueAt).toBe(eod('2026-10-05'))
    expect(parseQuickAdd('Lab report tues', NY, now).dueAt).toBe(eod('2026-10-06'))
  })
  it('treats today\'s weekday as today', () => {
    expect(parseQuickAdd('Read ch 4 thu', NY, now).dueAt).toBe(eod('2026-10-01'))
  })
  it('parses today / tomorrow / tmr', () => {
    expect(parseQuickAdd('Vocab today', NY, now).dueAt).toBe(eod('2026-10-01'))
    expect(parseQuickAdd('Vocab tomorrow', NY, now).dueAt).toBe(eod('2026-10-02'))
    expect(parseQuickAdd('Vocab tmr', NY, now).dueAt).toBe(eod('2026-10-02'))
  })
  it('parses "oct 9" and "9 oct"', () => {
    expect(parseQuickAdd('Midterm oct 9', NY, now)).toEqual({ title: 'Midterm', dueAt: eod('2026-10-09') })
    expect(parseQuickAdd('Midterm 9 October', NY, now).dueAt).toBe(eod('2026-10-09'))
  })
  it('rolls a past month/day into next year', () => {
    expect(parseQuickAdd('Final jan 15', NY, now).dueAt).toBe(new Date(Date.UTC(2027, 0, 16, 4, 59, 59)).toISOString())
  })
  it('keeps the full title and no date when there is no date word', () => {
    expect(parseQuickAdd('Read about lemons', NY, now)).toEqual({ title: 'Read about lemons', dueAt: null })
  })
  it('does not produce an empty title from a lone date word', () => {
    expect(parseQuickAdd('friday', NY, now)).toEqual({ title: 'friday', dueAt: null })
  })
  it('rejects impossible dates', () => {
    expect(parseQuickAdd('Thing feb 31', NY, now)).toEqual({ title: 'Thing feb 31', dueAt: null })
  })
  it('trims whitespace', () => {
    expect(parseQuickAdd('  Quiz   fri  ', NY, now).title).toBe('Quiz')
  })
})
