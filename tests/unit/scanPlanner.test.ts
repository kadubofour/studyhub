import { describe, it, expect, vi, beforeEach } from 'vitest'
import { COURSE_COLORS } from '@/lib/colors'

const createCourse = vi.fn(async (...a: unknown[]) => { const c = a[1] as { name: string; color: string }; return { id: `c-${c.name}`, ...c } })
const createTask = vi.fn(async (...a: unknown[]) => ({ id: 't', ...(a[1] as object) }))
const createClass = vi.fn(async (...a: unknown[]) => ({ id: 'k', ...(a[1] as object) }))
vi.mock('@/lib/data/courses', () => ({ createCourse: (...a: unknown[]) => createCourse(...a) }))
vi.mock('@/lib/data/tasks', () => ({ createTask: (...a: unknown[]) => createTask(...a) }))
vi.mock('@/lib/data/classes', () => ({ createClass: (...a: unknown[]) => createClass(...a) }))
import { PartialSaveError, matchCourse, plannerProblem, savePlanner, savedText, toDrafts } from '@/lib/scan/planner'

const courses = [{ id: 'c1', name: 'Biology', color: '#1D9E75' }]
const task = (over: object = {}) => ({ title: 'Essay', type: 'assignment' as const, due_date: '2026-10-16' as string | null, unsure: false, ...over })
const cls = (course: string, over: object = {}) => ({ course, day: 1, start: '09:00', end: '10:30', room: 'LT 2' as string | null, kind: 'lecture' as const, unsure: false, ...over })
beforeEach(() => { createCourse.mockClear(); createTask.mockClear(); createClass.mockClear() })

describe('matchCourse', () => {
  it('matches a course name ignoring case and spaces, or proposes a new one', () => {
    expect(matchCourse('  biology ', courses)).toEqual({ kind: 'existing', id: 'c1' })
    expect(matchCourse('Chemistry ', courses)).toEqual({ kind: 'new', name: 'Chemistry' })
  })
})

describe('toDrafts', () => {
  it('ticks everything, uses one spelling per new course, and blank for no date or room', () => {
    const d = toDrafts({ tasks: [task({ title: 'Midterm', type: 'exam', due_date: null, unsure: true })], classes: [cls('Chemistry', { room: null }), cls('chemistry')] }, courses)
    expect(d.tasks[0]).toEqual({ keep: true, title: 'Midterm', type: 'exam', due: '', unsure: true })
    expect(d.classes.map(c => c.course)).toEqual([{ kind: 'new', name: 'Chemistry' }, { kind: 'new', name: 'Chemistry' }])
    expect(d.classes[0].room).toBe('')
  })
})

describe('plannerProblem', () => {
  it('explains what stops saving', () => {
    const d = toDrafts({ tasks: [task()], classes: [cls('Biology')] }, courses)
    expect(plannerProblem(d)).toBeNull()
    expect(plannerProblem({ ...d, tasks: [{ ...d.tasks[0], title: ' ' }] })).toBe('Every task needs a title.')
    expect(plannerProblem({ ...d, classes: [{ ...d.classes[0], end: '08:00' }] })).toBe('Each class must end after it starts.')
    expect(plannerProblem({ ...d, classes: [{ ...d.classes[0], course: { kind: 'new', name: ' ' } }] })).toBe('Each class needs a course.')
    expect(plannerProblem({ tasks: d.tasks.map(t => ({ ...t, keep: false })), classes: d.classes.map(c => ({ ...c, keep: false })) })).toBe('Tick at least one item to save.')
  })
})

describe('savePlanner', () => {
  it('creates each new course once, then tasks due at the end of that day in the student\'s time zone, then classes', async () => {
    const d = toDrafts({ tasks: [task(), task({ title: 'Skip', due_date: null })], classes: [cls('biology'), cls('Chemistry'), cls('chemistry', { room: null })] }, courses)
    d.tasks[1].keep = false
    expect(await savePlanner({} as never, d, 'America/New_York', courses)).toEqual({ tasks: 1, classes: 3, courses: 1 })
    expect(createCourse.mock.calls.map(c => c[1])).toEqual([{ name: 'Chemistry', color: COURSE_COLORS[1] }])
    expect(createTask.mock.calls.map(c => c[1])).toEqual([{ title: 'Essay', type: 'assignment', due_at: '2026-10-17T03:59:59.000Z' }])
    expect(createClass.mock.calls.map(c => (c[1] as { course_id: string }).course_id)).toEqual(['c1', 'c-Chemistry', 'c-Chemistry'])
    expect(createClass.mock.calls[0][1]).toEqual({ course_id: 'c1', day_of_week: 1, start_time: '09:00', end_time: '10:30', location: 'LT 2', kind: 'lecture' })
    expect((createClass.mock.calls[2][1] as { location: string | null }).location).toBeNull()
  })
})

describe('savePlanner when the connection drops partway', () => {
  it('says exactly what was saved, so a retry doesn\'t save it twice', async () => {
    createTask.mockResolvedValueOnce({ id: 't1' }).mockRejectedValueOnce(new Error('offline'))
    const d = toDrafts({ tasks: [task(), task({ title: 'Lab report' })], classes: [cls('Chemistry')] }, courses)
    const e = await savePlanner({} as never, d, 'Africa/Accra', courses).catch(err => err)
    expect(e).toBeInstanceOf(PartialSaveError)
    expect([...(e as PartialSaveError).saved.tasks]).toEqual([0])
    expect([...(e as PartialSaveError).saved.classes]).toEqual([])
    expect((e as PartialSaveError).saved.courses).toEqual([{ id: 'c-Chemistry', name: 'Chemistry', color: COURSE_COLORS[1] }])
  })
})

describe('savedText', () => {
  it('says what was added', () => {
    expect(savedText({ tasks: 1, classes: 2 })).toBe('Added 1 task and 2 classes.')
    expect(savedText({ tasks: 3, classes: 0 })).toBe('Added 3 tasks.')
    expect(savedText({ tasks: 0, classes: 1 })).toBe('Added 1 class.')
  })
})
