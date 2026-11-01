import { describe, expect, it } from 'vitest'
import { ago, progressOf, studySets } from '@/lib/library/studySets'
import type { LibraryItem } from '@/lib/library/items'
import type { PlanRow } from '@/lib/plan/service'
import type { TopicStat } from '@/lib/topics/types'

const now = new Date('2030-05-10T12:00:00Z')
const iso = (msAgo: number) => new Date(now.getTime() - msAgo).toISOString()
const HOUR = 3_600_000, DAY = 24 * HOUR
const bio = { id: 'b', name: 'Biology', color: '#1D9E75' }, chem = { id: 'c', name: 'Chemistry', color: '#7F77DD' }, art = { id: 'a', name: 'Art history', color: '#D85A30' }
const item = (id: string, course: string | null, at: string): LibraryItem => ({ kind: 'note', id, title: id, course_id: course, at, meta: '', href: `/notes/${id}` })
const topic = (status: TopicStat['status']): TopicStat => ({ topic_id: status, name: status, position: 0, answers_30d: 0, correct_30d: 0, answers_all: 0, last_practised: null, notes: 0, lectures: 0, decks: 0, status })

describe('ago', () => {
  it.each([[30_000, 'just now'], [10 * 60_000, '10m ago'], [10 * HOUR, '10h ago'], [3 * DAY, '3d ago'], [21 * DAY, '3w ago']])('%d ms is "%s"', (ms, text) => expect(ago(iso(ms), now)).toBe(text))
  it('is a date after two months, and empty for nonsense', () => {
    expect(ago(iso(90 * DAY), now)).toMatch(/2030/)
    expect(ago('nope', now)).toBe('')
  })
})

describe('progressOf', () => {
  it('is the share of topics covered or mastered', () => {
    expect(progressOf([topic('covered'), topic('mastered'), topic('weak'), topic('not_started')])).toBe(50)
    expect(progressOf([])).toBe(0)
    expect(progressOf(undefined)).toBe(0)
  })
})

describe('studySets', () => {
  const items = [item('n1', 'b', iso(10 * HOUR)), item('n2', 'b', iso(2 * DAY)), item('n3', 'c', iso(HOUR)), item('loose', null, iso(1000))]
  const plan = { id: 'p', course_id: 'b', exam_task_id: 'e', mode: 'exam', minutes_per_day: 60, days_off: [], exam: { id: 'e', title: 'Midterm', due_at: new Date(now.getTime() + 5 * DAY).toISOString(), done_at: null } } as unknown as PlanRow
  const base = { courses: [bio, chem, art], items, plans: [plan], topics: { b: [topic('covered'), topic('weak')] }, now, q: '', sort: 'recent' as const }

  it('counts each course\'s materials, finds when it was last worked on and how far through its topics', () => {
    const [first] = studySets(base).filter(c => c.course.id === 'b')
    expect(first.materials).toBe(2)
    expect(first.lastAt).toBe(iso(10 * HOUR))
    expect(first.progress).toBe(50)
  })
  it('says where the study plan stands, or that there is none', () => {
    const lines = Object.fromEntries(studySets(base).map(c => [c.course.id, c.planLine]))
    expect(lines.b).toBe('Midterm in 5 days')
    expect(lines.c).toBe('You haven\'t started a study plan yet')
  })
  it('orders by last worked on, name or number of materials; a course with nothing comes last', () => {
    expect(studySets(base).map(c => c.course.id)).toEqual(['c', 'b', 'a'])
    expect(studySets({ ...base, sort: 'name' }).map(c => c.course.id)).toEqual(['a', 'b', 'c'])
    expect(studySets({ ...base, sort: 'materials' }).map(c => c.course.id)).toEqual(['b', 'c', 'a'])
  })
  it('searches course names, ignoring case', () => {
    expect(studySets({ ...base, q: ' CHEM ' }).map(c => c.course.id)).toEqual(['c'])
    expect(studySets({ ...base, q: 'zzz' })).toEqual([])
  })
})
