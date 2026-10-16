import { describe, it, expect } from 'vitest'
import { dueReminders, inQuietHours, WINDOW_MIN, type EngineInput } from '@/lib/reminders/engine'
import { DEFAULT_REMINDERS, parseReminders, type ReminderPrefs } from '@/lib/reminders/prefs'
import type { ClassSlot, Task } from '@/lib/types'

const TZ = 'Africa/Accra' // UTC+0, no daylight saving: local time is UTC
const at = (iso: string) => new Date(`${iso}Z`)
const prefs = (p: Partial<ReminderPrefs> = {}): ReminderPrefs => ({ ...DEFAULT_REMINDERS, on: true, quiet: null, ...p })
const task = (o: Partial<Task> & { id: string }): Task => ({ course_id: null, title: 'Essay', type: 'assignment', due_at: null, priority: 'normal', done_at: null, created_at: '2026-10-01T00:00:00Z', ...o })
const input = (o: Partial<EngineInput>): EngineInput => ({
  now: at('2026-10-16T12:00:00'), tz: TZ, prefs: prefs(), tasks: [], classes: [], dueCards: 0, todayMinutes: 0, goalMinutes: 120, ...o,
})
const keys = (i: EngineInput) => dueReminders(i).map(r => r.key)

describe('quiet hours', () => {
  it('wrap past midnight', () => {
    const q = { from: '22:00', to: '07:00' }
    expect(inQuietHours(at('2026-10-16T23:30:00'), TZ, q)).toBe(true)
    expect(inQuietHours(at('2026-10-16T06:59:00'), TZ, q)).toBe(true)
    expect(inQuietHours(at('2026-10-16T07:00:00'), TZ, q)).toBe(false)
    expect(inQuietHours(at('2026-10-16T12:00:00'), TZ, q)).toBe(false)
    expect(inQuietHours(at('2026-10-16T23:30:00'), TZ, null)).toBe(false)
  })
  it('a same-day window works too', () => {
    expect(inQuietHours(at('2026-10-16T13:00:00'), TZ, { from: '12:00', to: '14:00' })).toBe(true)
  })
  it('silence every reminder', () => {
    const i = input({ now: at('2026-10-16T23:00:00'), prefs: prefs({ quiet: { from: '22:00', to: '07:00' }, goal: '23:00' }) })
    expect(dueReminders(i)).toEqual([])
  })
})

describe('reminders that fall in quiet hours', () => {
  const quiet = { from: '22:00', to: '07:00' }
  it('a task due late at night is reminded before quiet hours begin, not lost', () => {
    const t = task({ id: 'late', title: 'Essay', due_at: '2026-10-16T23:59:00Z' }) // an hour before is 22:59: quiet
    const r = dueReminders(input({ now: at('2026-10-16T21:50:00'), prefs: prefs({ quiet }), tasks: [t] }))
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ title: 'Due soon', href: '/planner' })
    expect(r[0].body).toBe('Essay · Today 23:59')
    expect(keys(input({ now: at('2026-10-16T21:30:00'), prefs: prefs({ quiet }), tasks: [t] }))).toEqual([])
  })
  it('a task due early in the morning is reminded the evening before', () => {
    const t = task({ id: 'early', title: 'Quiz', due_at: '2026-10-17T06:00:00Z' })
    expect(keys(input({ now: at('2026-10-16T21:50:00'), prefs: prefs({ quiet }), tasks: [t] }))).toHaveLength(1)
  })
  it('a task whose reminder is in the day is untouched', () => {
    const t = task({ id: 'day', due_at: '2026-10-16T13:00:00Z' })
    expect(dueReminders(input({ now: at('2026-10-16T12:00:30'), prefs: prefs({ quiet }), tasks: [t] }))[0].title).toBe('Due in 1 hour')
  })
})

describe('the same reminder twice', () => {
  it('is one reminder when the exam and task leads are the same', () => {
    const exam = task({ id: 'x', type: 'exam', due_at: '2026-10-16T13:00:00Z' })
    expect(keys(input({ now: at('2026-10-16T12:00:30'), prefs: prefs({ examLead: 60 }), tasks: [exam] }))).toHaveLength(1)
  })
})

describe('master switch', () => {
  it('nothing fires while reminders are off', () => {
    expect(dueReminders(input({ now: at('2026-10-16T18:02:00'), prefs: { ...prefs({ cards: '18:00' }), on: false }, dueCards: 5 }))).toEqual([])
  })
})

describe('tasks', () => {
  const due = '2026-10-16T13:00:00Z'
  it('remind a set time before the due time, for ten minutes after', () => {
    const t = task({ id: 't1', due_at: due, title: 'Lab report' })
    expect(keys(input({ now: at('2026-10-16T11:59:00'), tasks: [t] }))).toEqual([]) // an hour before is 12:00
    const r = dueReminders(input({ now: at('2026-10-16T12:00:30'), tasks: [t] }))
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ title: 'Due in 1 hour', body: 'Lab report', href: '/planner' })
    expect(WINDOW_MIN).toBe(15)
    expect(keys(input({ now: at(`2026-10-16T12:${WINDOW_MIN}:00`), tasks: [t] }))).toEqual([]) // too late: not replayed
  })
  it('a task finished, or with no due time, or with the reminder off, gets nothing', () => {
    const now = at('2026-10-16T12:00:30')
    expect(keys(input({ now, tasks: [task({ id: 'a', due_at: due, done_at: '2026-10-16T09:00:00Z' })] }))).toEqual([])
    expect(keys(input({ now, tasks: [task({ id: 'b' })] }))).toEqual([])
    expect(keys(input({ now, prefs: prefs({ taskLead: null }), tasks: [task({ id: 'c', due_at: due })] }))).toEqual([])
  })
  it('changing the due time is a new reminder', () => {
    const a = keys(input({ now: at('2026-10-16T12:00:30'), tasks: [task({ id: 't', due_at: due })] }))
    const b = keys(input({ now: at('2026-10-16T13:00:30'), tasks: [task({ id: 't', due_at: '2026-10-16T14:00:00Z' })] }))
    expect(a[0]).not.toEqual(b[0])
  })
  it('an exam also gets its early reminder', () => {
    const exam = task({ id: 'x', type: 'exam', title: 'Biology exam', due_at: '2026-10-17T12:00:00Z' })
    const r = dueReminders(input({ now: at('2026-10-16T12:02:00'), tasks: [exam] }))
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ title: 'Exam in 1 day', body: 'Biology exam' })
  })
  it('lead at the due time says it is due now', () => {
    const r = dueReminders(input({ now: at('2026-10-16T13:01:00'), prefs: prefs({ taskLead: 0 }), tasks: [task({ id: 't', due_at: due })] }))
    expect(r[0].title).toBe('Due now')
  })
})

describe('classes', () => {
  // 2026-10-16 is a Friday: day_of_week 5
  const cls: ClassSlot = { id: 'c1', course_id: 'x', day_of_week: 5, start_time: '14:00:00', end_time: '15:00:00', location: 'Room 4', kind: 'lecture' }
  it('remind before a class starts that day', () => {
    expect(keys(input({ now: at('2026-10-16T13:49:00'), classes: [cls] }))).toEqual([])
    const r = dueReminders(input({ now: at('2026-10-16T13:50:30'), classes: [cls] }))
    expect(r[0]).toMatchObject({ title: 'Class in 10 minutes', body: 'Lecture at 14:00 · Room 4', href: '/planner' })
  })
  it('a class on another day, or with the reminder off, gets nothing', () => {
    expect(keys(input({ now: at('2026-10-16T13:50:30'), classes: [{ ...cls, day_of_week: 4 }] }))).toEqual([])
    expect(keys(input({ now: at('2026-10-16T13:50:30'), prefs: prefs({ classLead: null }), classes: [cls] }))).toEqual([])
  })
})

describe('once a day', () => {
  it('flashcards: only when cards are due, at the time', () => {
    const p = prefs({ cards: '18:00' })
    expect(keys(input({ now: at('2026-10-16T18:02:00'), prefs: p, dueCards: 0 }))).toEqual([])
    const r = dueReminders(input({ now: at('2026-10-16T18:02:00'), prefs: p, dueCards: 12 }))
    expect(r[0]).toMatchObject({ key: 'cards:2026-10-16', title: 'Flashcards to review', body: '12 cards are due.', href: '/flashcards' })
    expect(dueReminders(input({ now: at('2026-10-16T17:59:00'), prefs: p, dueCards: 12 }))).toEqual([])
    expect(dueReminders(input({ now: at('2026-10-16T18:02:00'), prefs: prefs({ cards: null }), dueCards: 12 }))).toEqual([])
    expect(dueReminders(input({ now: at('2026-10-16T18:02:00'), prefs: p, dueCards: 1 }))[0].body).toBe('1 card is due.')
  })
  it('daily goal: only when today is under the goal', () => {
    const p = prefs({ goal: '20:00' })
    const now = at('2026-10-16T20:01:00')
    const r = dueReminders(input({ now, prefs: p, todayMinutes: 35, goalMinutes: 120 }))
    expect(r[0]).toMatchObject({ key: 'goal:2026-10-16', title: 'Daily goal', body: '35 of 120 minutes so far. 85 to go.', href: '/focus' })
    expect(dueReminders(input({ now, prefs: p, todayMinutes: 120, goalMinutes: 120 }))).toEqual([])
  })
  it("today's plan: what is due today and the classes on", () => {
    const p = prefs({ morning: '08:00' })
    const now = at('2026-10-16T08:03:00')
    const tasks = [task({ id: 'a', due_at: '2026-10-16T15:00:00Z' }), task({ id: 'b', due_at: '2026-10-16T20:00:00Z' }), task({ id: 'c', due_at: '2026-10-17T09:00:00Z' })]
    const cls: ClassSlot = { id: 'c1', course_id: 'x', day_of_week: 5, start_time: '09:00:00', end_time: '10:00:00', location: null, kind: 'lecture' }
    const r = dueReminders(input({ now, prefs: p, tasks, classes: [cls] }))
    const plan = r.find(x => x.key === 'plan:2026-10-16')!
    expect(plan).toMatchObject({ title: "Today's plan", body: '2 tasks due and 1 class today.', href: '/home' })
    expect(keys(input({ now, prefs: p }))).toEqual([]) // nothing on: no message
    expect(dueReminders(input({ now, prefs: p, tasks: [task({ id: 'z', due_at: '2026-10-16T15:00:00Z' })] })).find(x => x.key.startsWith('plan'))!.body).toBe('1 task due today.')
  })
})

describe('time zones', () => {
  it('a daily time is in the student’s own time', () => {
    const p = prefs({ cards: '18:00' })
    // 18:00 in Lagos (UTC+1) is 17:00 UTC
    expect(keys(input({ tz: 'Africa/Lagos', now: at('2026-10-16T17:01:00'), prefs: p, dueCards: 3 }))).toEqual(['cards:2026-10-16'])
    expect(keys(input({ tz: 'Africa/Lagos', now: at('2026-10-16T18:01:00'), prefs: p, dueCards: 3 }))).toEqual([])
  })
})

describe('settings read from storage', () => {
  it('fill in what is missing and drop what is wrong', () => {
    expect(parseReminders(null)).toEqual(DEFAULT_REMINDERS)
    const p = parseReminders({ on: true, taskLead: 'soon', classLead: 30, cards: '25:99', goal: '19:30', quiet: { from: '23:00', to: 'x' }, morning: false })
    expect(p).toMatchObject({ on: true, taskLead: DEFAULT_REMINDERS.taskLead, classLead: 30, cards: DEFAULT_REMINDERS.cards, goal: '19:30', quiet: DEFAULT_REMINDERS.quiet, morning: null })
  })
})
