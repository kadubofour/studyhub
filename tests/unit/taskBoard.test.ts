import { describe, it, expect } from 'vitest'
import { boardColumns, boardSummary, rescheduleTo } from '@/lib/tasks/board'
import type { Task } from '@/lib/types'

const TZ = 'Africa/Accra' // UTC+0
const NOW = new Date('2026-10-14T10:00:00Z') // Wednesday
const task = (id: string, due: string | null, over: Partial<Task> = {}): Task =>
  ({ id, course_id: null, title: id, type: 'other', due_at: due, priority: 'normal', done_at: null, created_at: '', ...over })

describe('boardColumns', () => {
  const tasks = [
    task('late', '2026-10-12T23:59:59Z'), task('today', '2026-10-14T23:59:59Z'), task('thu', '2026-10-15T23:59:59Z'),
    task('sun', '2026-10-18T23:59:59Z'), task('nextmon', '2026-10-19T23:59:59Z'), task('far', '2026-12-01T23:59:59Z'), task('none', null),
    task('done', '2026-10-14T23:59:59Z', { done_at: '2026-10-13T00:00:00Z' }),
  ]
  const cols = boardColumns(tasks, TZ, NOW)
  const ids = (k: keyof typeof cols) => cols[k].map(t => t.id)
  it('puts what is late and what is due today in the first column, late first', () => {
    expect(ids('overdue')).toEqual(['late'])
    expect(ids('today')).toEqual(['today'])
  })
  it('puts the rest of this week (to Sunday) in its own column, in date order', () => {
    expect(ids('week')).toEqual(['thu', 'sun'])
  })
  it('puts dated tasks beyond this week in Later, and tasks with no date in Someday', () => {
    expect(ids('later')).toEqual(['nextmon', 'far'])
    expect(ids('someday')).toEqual(['none'])
  })
  it('leaves finished tasks out', () => {
    expect(Object.values(cols).flat().some(t => t.id === 'done')).toBe(false)
  })
})

describe('boardSummary', () => {
  it('counts what is late, due today and due the rest of this week', () => {
    const cols = boardColumns([task('a', '2026-10-12T23:59:59Z'), task('b', '2026-10-14T23:59:59Z'), task('c', '2026-10-14T23:59:59Z'), task('d', '2026-10-16T23:59:59Z')], TZ, NOW)
    expect(boardSummary(cols)).toBe('1 overdue · 2 due today · 1 more this week')
  })
  it('says so when nothing is due', () => {
    expect(boardSummary(boardColumns([task('x', null)], TZ, NOW))).toBe('Nothing due this week')
  })
  it('uses the singular for one', () => {
    expect(boardSummary(boardColumns([task('b', '2026-10-14T23:59:59Z')], TZ, NOW))).toBe('1 due today')
  })
})

describe('rescheduleTo', () => {
  it('moves a task to the end of today, tomorrow or a week from today in the student time zone', () => {
    expect(rescheduleTo('today', TZ, NOW)).toBe('2026-10-14T23:59:59.000Z')
    expect(rescheduleTo('tomorrow', TZ, NOW)).toBe('2026-10-15T23:59:59.000Z')
    expect(rescheduleTo('nextweek', TZ, NOW)).toBe('2026-10-21T23:59:59.000Z')
  })
  it('can take the date away', () => {
    expect(rescheduleTo('none', TZ, NOW)).toBeNull()
  })
  it('counts the day in the student time zone, not UTC', () => {
    // 23:30 UTC on the 14th is already the 15th in Paris
    expect(rescheduleTo('today', 'Europe/Paris', new Date('2026-10-14T23:30:00Z'))).toBe('2026-10-15T21:59:59.000Z')
  })
})
