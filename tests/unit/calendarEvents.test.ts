import { describe, it, expect } from 'vitest'
import { classLanes, dayItems, nowOffsetPx } from '@/lib/calendar/events'
import type { Task } from '@/lib/types'

describe('nowOffsetPx', () => {
  const tz = 'Africa/Accra' // UTC+0
  it('is how far down the grid the current time is', () => {
    expect(nowOffsetPx(new Date('2026-10-12T10:30:00Z'), tz, 7, 21, 40)).toBe(3.5 * 40)
  })
  it('is nothing before the grid starts or after it ends', () => {
    expect(nowOffsetPx(new Date('2026-10-12T05:00:00Z'), tz, 7, 21, 40)).toBeNull()
    expect(nowOffsetPx(new Date('2026-10-12T21:30:00Z'), tz, 7, 21, 40)).toBeNull()
  })
  it('uses the student time zone, not the machine one', () => {
    expect(nowOffsetPx(new Date('2026-10-12T10:00:00Z'), 'America/New_York', 0, 24, 40)).toBe(6 * 40) // 06:00 in New York
  })
})

describe('classLanes', () => {
  const s = (id: string, start: string, end: string) => ({ id, start_time: start, end_time: end })
  it('gives a lone class the whole width', () => {
    expect(classLanes([s('a', '09:00:00', '10:00:00')]).get('a')).toEqual({ lane: 0, lanes: 1 })
  })
  it('puts classes that overlap side by side', () => {
    const l = classLanes([s('a', '09:00:00', '10:30:00'), s('b', '10:00:00', '11:00:00')])
    expect(l.get('a')).toEqual({ lane: 0, lanes: 2 })
    expect(l.get('b')).toEqual({ lane: 1, lanes: 2 })
  })
  it('does not narrow classes that merely follow one another', () => {
    const l = classLanes([s('a', '09:00:00', '10:00:00'), s('b', '10:00:00', '11:00:00')])
    expect(l.get('a')).toEqual({ lane: 0, lanes: 1 })
    expect(l.get('b')).toEqual({ lane: 0, lanes: 1 })
  })
  it('reuses a free lane inside a busy stretch', () => {
    const l = classLanes([s('a', '09:00:00', '12:00:00'), s('b', '09:30:00', '10:00:00'), s('c', '10:30:00', '11:00:00')])
    expect(l.get('a')).toEqual({ lane: 0, lanes: 2 })
    expect(l.get('b')).toEqual({ lane: 1, lanes: 2 })
    expect(l.get('c')).toEqual({ lane: 1, lanes: 2 })
  })
})

describe('dayItems', () => {
  const tz = 'Africa/Accra'
  const task = (id: string, title: string, over: Partial<Task> = {}): Task =>
    ({ id, course_id: null, title, type: 'other', due_at: '2026-10-12T23:59:59Z', priority: 'normal', done_at: null, created_at: '', ...over })
  it('lists the tasks due that day, exams first, then high priority, then by title', () => {
    const items = dayItems('2026-10-12', [
      task('a', 'Zebra essay'), task('b', 'Alpha essay'), task('c', 'Midterm', { type: 'exam' }), task('d', 'Read ch 3', { priority: 'high' }),
      task('e', 'Other day', { due_at: '2026-10-13T12:00:00Z' }),
    ], [], tz)
    expect(items.map(i => i.title)).toEqual(['Midterm', 'Read ch 3', 'Alpha essay', 'Zebra essay'])
  })
  it('leaves out finished tasks and tasks without a date', () => {
    expect(dayItems('2026-10-12', [task('a', 'Done', { done_at: '2026-10-11T00:00:00Z' }), task('b', 'No date', { due_at: null })], [], tz)).toEqual([])
  })
  it('puts study sessions after the tasks', () => {
    const items = dayItems('2026-10-12', [task('a', 'Essay')], [{ id: 's1', title: 'Learn: Glycolysis', courseId: 'bio' }], tz)
    expect(items.map(i => [i.kind, i.title])).toEqual([['task', 'Essay'], ['session', 'Learn: Glycolysis']])
  })
  it('uses the student time zone for which day a task falls on', () => {
    // 23:30 UTC on the 12th is already the 13th in Paris
    const items = dayItems('2026-10-13', [task('a', 'Late', { due_at: '2026-10-12T23:30:00Z' })], [], 'Europe/Paris')
    expect(items.map(i => i.title)).toEqual(['Late'])
  })
})
