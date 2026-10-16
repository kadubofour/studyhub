import { describe, it, expect } from 'vitest'
import { classLanes, dayItems, examBlocks, nowFraction } from '@/lib/calendar/events'
import type { Task } from '@/lib/types'

describe('nowFraction', () => {
  const tz = 'Africa/Accra' // UTC+0
  it('is how far down the hours the current time is, from 0 to 1', () => {
    expect(nowFraction(new Date('2026-10-12T10:30:00Z'), tz, 7, 21)).toBeCloseTo(3.5 / 14, 10)
  })
  it('is nothing before the hours start or after they end', () => {
    expect(nowFraction(new Date('2026-10-12T05:00:00Z'), tz, 7, 21)).toBeNull()
    expect(nowFraction(new Date('2026-10-12T21:30:00Z'), tz, 7, 21)).toBeNull()
  })
  it('uses the student time zone, not the machine one', () => {
    expect(nowFraction(new Date('2026-10-12T10:00:00Z'), 'America/New_York', 0, 24)).toBeCloseTo(6 / 24, 10) // 06:00 in New York
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

describe('exams with a time', () => {
  const tz = 'Africa/Accra'
  const exam = (id: string, title: string, over: Partial<Task> = {}): Task =>
    ({ id, course_id: 'bio', title, type: 'exam', due_at: '2026-10-12T14:00:00Z', priority: 'normal', done_at: null, created_at: '', duration_min: 120, location: 'Hall B', ...over })

  it('is a block from its start to its end, with where it is', () => {
    const blocks = examBlocks('2026-10-12', [exam('e1', 'Midterm')], tz)
    expect(blocks).toEqual([{ id: 'e1', title: 'Midterm', courseId: 'bio', start: '14:00', end: '16:00', location: 'Hall B' }])
  })
  it('without a length it is an hour, and it stops at midnight', () => {
    expect(examBlocks('2026-10-12', [exam('e1', 'Quiz', { duration_min: null })], tz)[0]).toMatchObject({ start: '14:00', end: '15:00' })
    expect(examBlocks('2026-10-12', [exam('e1', 'Late', { due_at: '2026-10-12T22:30:00Z', duration_min: 240 })], tz)[0]).toMatchObject({ start: '22:30', end: '23:59' })
  })
  it('uses the time zone of the student for the day and the hours', () => {
    expect(examBlocks('2026-10-12', [exam('e1', 'X', { due_at: '2026-10-12T13:00:00Z' })], 'Africa/Lagos')[0]).toMatchObject({ start: '14:00', end: '16:00' })
    expect(examBlocks('2026-10-13', [exam('e1', 'X', { due_at: '2026-10-12T23:30:00Z' })], 'Europe/Paris')[0]).toMatchObject({ start: '01:30' })
  })
  it('leaves out an exam with no time yet, a finished one, other days and things that are not exams', () => {
    expect(examBlocks('2026-10-12', [
      exam('a', 'No time', { due_at: '2026-10-12T23:59:59Z' }), exam('b', 'Done', { done_at: '2026-10-01T00:00:00Z' }),
      exam('c', 'Another day', { due_at: '2026-10-13T10:00:00Z' }), exam('d', 'Essay', { type: 'assignment' }),
    ], tz)).toEqual([])
  })
  it('stays in the all-day row only when it has no time, if the grid shows its blocks; the month keeps every one', () => {
    const tasks = [exam('a', 'Timed'), exam('b', 'No time', { due_at: '2026-10-12T23:59:59Z' })]
    expect(dayItems('2026-10-12', tasks, [], tz).map(i => i.title)).toEqual(['No time', 'Timed'])
    expect(dayItems('2026-10-12', tasks, [], tz, { timedExamsAreBlocks: true }).map(i => i.title)).toEqual(['No time'])
  })
  it('a chip for a timed exam says when it starts', () => {
    const chip = dayItems('2026-10-12', [exam('a', 'Timed')], [], tz)[0]
    expect(chip.time).toBe('14:00')
  })
})
