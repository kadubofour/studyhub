import { describe, it, expect } from 'vitest'
import { countdown, durationWords, examDueAt, examEnd, examHasTime, examLine, EXAM_KINDS, suggestTitle } from '@/lib/exams'
import type { Task } from '@/lib/types'

const TZ = 'Africa/Accra' // UTC+0 all year
const LAGOS = 'Africa/Lagos' // UTC+1
const exam = (o: Partial<Task> = {}): Task => ({ id: 'e', course_id: null, title: 'Midterm', type: 'exam', due_at: '2026-11-14T14:00:00Z', priority: 'normal', done_at: null, created_at: '2026-10-01T00:00:00Z', ...o })

describe('what an exam has', () => {
  it('knows the kinds', () => {
    expect(EXAM_KINDS.map(k => k.id)).toEqual(['quiz', 'test', 'midterm', 'final', 'practical', 'oral'])
  })
})

describe('the time of an exam', () => {
  it('an exam at a time on a day has a time; one due at the end of the day does not yet', () => {
    expect(examHasTime('2026-11-14T14:00:00Z', TZ)).toBe(true)
    expect(examHasTime('2026-11-14T23:59:59Z', TZ)).toBe(false)
    expect(examHasTime(null, TZ)).toBe(false)
    expect(examHasTime('2026-11-14T22:59:59Z', LAGOS)).toBe(false) // 23:59 in Lagos
    expect(examHasTime('2026-11-14T13:00:00Z', LAGOS)).toBe(true) // 14:00 in Lagos
  })
  it('puts a date and a start time together in the time zone of the student, or the end of the day with no time', () => {
    expect(examDueAt('2026-11-14', '14:00', TZ)).toBe('2026-11-14T14:00:00.000Z')
    expect(examDueAt('2026-11-14', '14:00', LAGOS)).toBe('2026-11-14T13:00:00.000Z')
    expect(examDueAt('2026-11-14', null, TZ)).toBe('2026-11-14T23:59:59.000Z')
  })
  it('ends when its length is up, and has no end without a time or a length', () => {
    expect(examEnd(exam({ duration_min: 120 }), TZ)!.toISOString()).toBe('2026-11-14T16:00:00.000Z')
    expect(examEnd(exam({ duration_min: null }), TZ)).toBeNull()
    expect(examEnd(exam({ due_at: '2026-11-14T23:59:59Z', duration_min: 120 }), TZ)).toBeNull()
  })
})

describe('words', () => {
  it('lengths', () => {
    expect(durationWords(45)).toBe('45 min')
    expect(durationWords(60)).toBe('1 h')
    expect(durationWords(90)).toBe('1 h 30 min')
    expect(durationWords(180)).toBe('3 h')
  })
  it('suggests a title from the course and the kind', () => {
    expect(suggestTitle('Biology', 'midterm')).toBe('Biology midterm')
    expect(suggestTitle('Biology', null)).toBe('Biology exam')
    expect(suggestTitle(undefined, 'final')).toBe('Final exam')
    expect(suggestTitle(undefined, 'quiz')).toBe('Quiz')
    expect(suggestTitle(undefined, null)).toBe('')
  })
  it('describes an exam in one line', () => {
    expect(examLine(exam({ duration_min: 120, location: 'Hall B' }), TZ)).toBe('Sat 14 Nov · 14:00 to 16:00 · Hall B')
    expect(examLine(exam({ duration_min: null, location: null }), TZ)).toBe('Sat 14 Nov · 14:00')
    expect(examLine(exam({ due_at: '2026-11-14T23:59:59Z', location: 'Hall B' }), TZ)).toBe('Sat 14 Nov · time to be announced · Hall B')
    expect(examLine(exam({ due_at: null }), TZ)).toBe('No date yet')
  })
  it('counts the days to go in the days of the student', () => {
    const now = new Date('2026-11-02T09:00:00Z')
    expect(countdown('2026-11-02T14:00:00Z', now, TZ)).toBe('today')
    expect(countdown('2026-11-03T08:00:00Z', now, TZ)).toBe('tomorrow')
    expect(countdown('2026-11-14T14:00:00Z', now, TZ)).toBe('in 12 days')
    expect(countdown('2026-12-20T14:00:00Z', now, TZ)).toBe('in 7 weeks')
    expect(countdown('2026-11-01T14:00:00Z', now, TZ)).toBe('yesterday')
    expect(countdown('2026-10-20T14:00:00Z', now, TZ)).toBe('13 days ago')
  })
})

import { keepTimeOfDay } from '@/lib/exams'
describe('moving an exam to another day', () => {
  const end = '2026-11-15T23:59:59.000Z' // the end of 15 November, which is where a quick move puts a task
  it('keeps the time it starts at', () => {
    expect(keepTimeOfDay(exam({ due_at: '2026-11-14T14:00:00Z' }), end, TZ)).toBe('2026-11-15T14:00:00.000Z')
    expect(keepTimeOfDay(exam({ due_at: '2026-11-14T13:00:00Z' }), '2026-11-15T22:59:59.000Z', LAGOS)).toBe('2026-11-15T13:00:00.000Z') // 14:00 in Lagos
  })
  it('moves an exam with no time to the end of the day, and clears the date when asked', () => {
    expect(keepTimeOfDay(exam({ due_at: '2026-11-14T23:59:59Z' }), end, TZ)).toBe(end)
    expect(keepTimeOfDay(exam({ due_at: '2026-11-14T14:00:00Z' }), null, TZ)).toBeNull()
  })
  it('leaves other tasks alone', () => {
    expect(keepTimeOfDay(exam({ type: 'assignment', due_at: '2026-11-14T14:00:00Z' }), end, TZ)).toBe(end)
  })
})
describe('countdown for an exam that is already over', () => {
  it('says so on the day itself', () => {
    expect(countdown('2026-11-14T09:00:00Z', new Date('2026-11-14T15:00:00Z'), TZ, 120)).toBe('today, over')
    expect(countdown('2026-11-14T09:00:00Z', new Date('2026-11-14T08:00:00Z'), TZ, 120)).toBe('today')
    expect(countdown('2026-11-14T09:00:00Z', new Date('2026-11-14T10:30:00Z'), TZ, 120)).toBe('today, on now')
    expect(countdown('2026-11-14T09:00:00Z', new Date('2026-11-13T15:00:00Z'), TZ, 120)).toBe('tomorrow')
  })
})
