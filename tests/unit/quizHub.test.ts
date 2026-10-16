import { describe, it, expect } from 'vitest'
import { buildQuizHub, filterRows, type HubInput } from '@/lib/quiz/hub'

const q = (id: string, note_id: string, title: string, n = 5, created_at = '2026-10-01T00:00:00Z') => ({ id, note_id, title, created_at, questions: Array.from({ length: n }, (_, i) => ({ id: `${id}-${i}` })) })
const a = (id: string, quiz_id: string, correct: number, total: number, finished_at: string) => ({ id, quiz_id, correct, total, finished_at })
const input = (o: Partial<HubInput> = {}): HubInput => ({
  quizzes: [], attempts: [], notes: [{ id: 'n1', title: 'Cells', course_id: 'c1' }, { id: 'n2', title: 'Loose note', course_id: null }],
  courses: [{ id: 'c1', name: 'Biology', color: '#2f9e44' }], now: new Date('2026-10-16T12:00:00Z'), ...o,
})

describe('buildQuizHub', () => {
  it('is empty and says so with nothing taken', () => {
    const h = buildQuizHub(input())
    expect(h.rows).toEqual([])
    expect(h.stats).toMatchObject({ quizzes: 0, taken: 0, average: null, best: null, right: 0, answered: 0, lastWeek: 0 })
    expect(h.trend).toEqual([])
    expect(h.byCourse).toEqual([])
    expect(h.needsWork).toEqual([])
  })

  it('totals what has been taken', () => {
    const h = buildQuizHub(input({
      quizzes: [q('a', 'n1', 'Cells quiz'), q('b', 'n1', 'Organelles', 4)],
      attempts: [a('1', 'a', 4, 5, '2026-10-08T10:00:00Z'), a('2', 'a', 5, 5, '2026-10-15T10:00:00Z'), a('3', 'b', 1, 4, '2026-10-16T09:00:00Z')],
    }))
    expect(h.stats).toEqual({ quizzes: 2, taken: 3, average: Math.round((80 + 100 + 25) / 3), best: 100, right: 10, answered: 14, lastWeek: 2 })
  })

  it('a row per quiz with its note, course, best and latest score', () => {
    const h = buildQuizHub(input({
      quizzes: [q('a', 'n1', 'Cells quiz', 5, '2026-10-02T00:00:00Z'), q('b', 'n2', 'Loose', 3, '2026-10-05T00:00:00Z'), q('c', 'n1', 'Never taken', 8, '2026-10-09T00:00:00Z')],
      attempts: [a('1', 'a', 5, 5, '2026-10-10T10:00:00Z'), a('2', 'a', 2, 5, '2026-10-14T10:00:00Z')],
    }))
    const byId = Object.fromEntries(h.rows.map(r => [r.id, r]))
    expect(byId.a).toMatchObject({ noteTitle: 'Cells', courseName: 'Biology', courseColor: '#2f9e44', questions: 5, attempts: 2, bestPct: 100, lastPct: 40, lastAt: '2026-10-14T10:00:00Z' })
    expect(byId.b).toMatchObject({ noteTitle: 'Loose note', courseName: null, attempts: 0, bestPct: null, lastPct: null, lastAt: null })
    expect(byId.c.attempts).toBe(0)
    expect(h.rows.map(r => r.id)).toEqual(['c', 'b', 'a']) // newest first
  })

  it('a quiz whose note was deleted still shows', () => {
    const h = buildQuizHub(input({ quizzes: [q('a', 'gone', 'Orphan')] }))
    expect(h.rows[0]).toMatchObject({ noteTitle: null, courseName: null })
  })

  it('the trend is the last twelve attempts, oldest first', () => {
    const attempts = Array.from({ length: 15 }, (_, i) => a(String(i), 'a', i % 5, 5, `2026-10-${String(i + 1).padStart(2, '0')}T10:00:00Z`))
    const h = buildQuizHub(input({ quizzes: [q('a', 'n1', 'Cells quiz')], attempts }))
    expect(h.trend).toHaveLength(12)
    expect(h.trend[0].id).toBe('3')
    expect(h.trend[11].id).toBe('14')
    expect(h.trend[0]).toMatchObject({ title: 'Cells quiz', pct: 60 })
  })

  it('averages by course, weakest first, with no-course attempts together', () => {
    const h = buildQuizHub(input({
      quizzes: [q('a', 'n1', 'Cells quiz'), q('b', 'n2', 'Loose')],
      attempts: [a('1', 'a', 5, 5, '2026-10-10T10:00:00Z'), a('2', 'b', 1, 5, '2026-10-11T10:00:00Z'), a('3', 'b', 2, 5, '2026-10-12T10:00:00Z')],
    }))
    expect(h.byCourse).toEqual([
      { courseId: null, name: 'No course', color: null, attempts: 2, avgPct: 30 },
      { courseId: 'c1', name: 'Biology', color: '#2f9e44', attempts: 1, avgPct: 100 },
    ])
  })

  it('suggests the quizzes last scored under 60%, lowest first, at most three', () => {
    const quizzes = ['a', 'b', 'c', 'd', 'e'].map(id => q(id, 'n1', id))
    const h = buildQuizHub(input({
      quizzes,
      attempts: [a('1', 'a', 1, 5, '2026-10-10T10:00:00Z'), a('2', 'b', 1, 5, '2026-10-10T10:00:00Z'), a('3', 'c', 0, 5, '2026-10-10T10:00:00Z'), a('4', 'd', 5, 5, '2026-10-10T10:00:00Z'),
        a('5', 'a', 2, 5, '2026-10-12T10:00:00Z'), a('6', 'e', 3, 5, '2026-10-10T10:00:00Z')],
    }))
    expect(h.needsWork.map(r => r.id)).toEqual(['c', 'b', 'a']) // e is exactly 60%, d is 100%; a's latest (40%) counts, not its first (20%)
  })

  it('an attempt on a quiz that was deleted is left out', () => {
    const h = buildQuizHub(input({ quizzes: [q('a', 'n1', 'Cells quiz')], attempts: [a('1', 'gone', 5, 5, '2026-10-10T10:00:00Z')] }))
    expect(h.stats.taken).toBe(0)
  })
})

describe('filterRows', () => {
  const h = buildQuizHub(input({
    quizzes: [q('a', 'n1', 'Cells quiz', 5, '2026-10-02T00:00:00Z'), q('b', 'n2', 'Algebra', 3, '2026-10-05T00:00:00Z'), q('c', 'n1', 'Krebs cycle', 8, '2026-10-09T00:00:00Z')],
    attempts: [a('1', 'a', 5, 5, '2026-10-10T10:00:00Z'), a('2', 'a', 2, 5, '2026-10-14T10:00:00Z'), a('3', 'b', 1, 5, '2026-10-11T10:00:00Z')],
  }))
  const ids = (rows: { id: string }[]) => rows.map(r => r.id)
  it('searches the title and the note, ignoring case', () => {
    expect(ids(filterRows(h.rows, { query: 'KREBS', course: 'all', sort: 'newest' }))).toEqual(['c'])
    expect(ids(filterRows(h.rows, { query: 'loose', course: 'all', sort: 'newest' }))).toEqual(['b'])
  })
  it('filters by course, or by no course', () => {
    expect(ids(filterRows(h.rows, { query: '', course: 'c1', sort: 'newest' }))).toEqual(['c', 'a'])
    expect(ids(filterRows(h.rows, { query: '', course: 'none', sort: 'newest' }))).toEqual(['b'])
  })
  it('sorts', () => {
    expect(ids(filterRows(h.rows, { query: '', course: 'all', sort: 'oldest' }))).toEqual(['a', 'b', 'c'])
    expect(ids(filterRows(h.rows, { query: '', course: 'all', sort: 'lowest' }))).toEqual(['b', 'a', 'c']) // by last score; never taken last
    expect(ids(filterRows(h.rows, { query: '', course: 'all', sort: 'most' }))).toEqual(['a', 'b', 'c']) // by times taken
  })
})
