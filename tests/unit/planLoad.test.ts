import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { DayRow, PlanRow } from '@/lib/plan/service'
import type { TopicStat } from '@/lib/topics/types'

const TZ = 'UTC'
const NOW = new Date('2026-10-12T09:00:00Z') // Monday
const stat = (id: string, name: string, over: Partial<TopicStat> = {}): TopicStat => ({
  topic_id: id, name, position: 1, answers_30d: 0, correct_30d: 0, answers_all: 0, last_practised: null, notes: 1, lectures: 0, decks: 0, status: 'not_started', ...over,
})
const plan = (over: Partial<PlanRow> = {}): PlanRow => ({
  id: 'p1', course_id: 'c1', exam_task_id: 'e1', mode: 'balanced', minutes_per_day: 60, days_off: [],
  exam: { id: 'e1', title: 'Midterm', due_at: '2026-10-26T09:00:00Z', done_at: null }, ...over,
})
let plans: PlanRow[], days: DayRow[], stats: TopicStat[], links: { topic_id: string; link: { kind: 'note' | 'lecture' | 'deck'; id: string } }[]
const ensureDay = vi.fn(async (_sb: unknown, planId: string, day: string, sessions: DayRow['sessions']) => ({ id: `d-${day}`, plan_id: planId, day, sessions }))
const sb = { from: () => ({ select: () => ({ in: async () => ({ data: [{ id: 'n1', updated_at: '2026-10-01T00:00:00Z' }, { id: 'n2', updated_at: '2026-10-05T00:00:00Z' }], error: null }) }) }) }
vi.mock('@/lib/plan/service', () => ({
  listPlans: async () => plans, listPlanDays: async () => days, ensureDay: (...a: unknown[]) => ensureDay(...(a as [unknown, string, string, DayRow['sessions']])),
}))
vi.mock('@/lib/data/topics', () => ({ listTopicStats: async () => stats, listTopicLinks: async () => links }))
import { loadPlans } from '@/lib/plan/load'

beforeEach(() => {
  plans = [plan()]; days = []; ensureDay.mockClear()
  stats = [stat('t1', 'Krebs cycle', { status: 'weak', answers_30d: 10, correct_30d: 3 }), stat('t2', 'Glycolysis')]
  links = [{ topic_id: 't1', link: { kind: 'note', id: 'n1' } }, { topic_id: 't2', link: { kind: 'note', id: 'n1' } }, { topic_id: 't2', link: { kind: 'note', id: 'n2' } }]
})
const load = () => loadPlans(sb as never, TZ, NOW)

describe('loadPlans', () => {
  it('saves today\'s list the first time the day is opened, with topic names and the newest linked note', async () => {
    const [v] = await load()
    expect(ensureDay).toHaveBeenCalledTimes(1)
    expect(ensureDay.mock.calls[0][2]).toBe('2026-10-12')
    expect(v.status).toBe('ok')
    expect(v.daysToExam).toBe(14)
    expect(v.today.length).toBeGreaterThan(0)
    expect(v.today[0]).toMatchObject({ topic_id: 't1', kind: 'learn', topicName: 'Krebs cycle', done_at: null, noteId: 'n1' })
    expect(v.today.find(s => s.topic_id === 't2')!.noteId).toBe('n2') // newest of its notes
    expect(v.todayDayId).toBe('d-2026-10-12')
  })
  it('uses the saved list when the day was already opened, and does not save again', async () => {
    days = [{ id: 'd1', plan_id: 'p1', day: '2026-10-12', sessions: [{ id: 's1', topic_id: 't2', kind: 'learn', minutes: 25, done_at: null }] }]
    const [v] = await load()
    expect(ensureDay).not.toHaveBeenCalled()
    expect(v.today.map(s => s.id)).toEqual(['s1'])
    expect(v.todayDayId).toBe('d1')
  })
  it('plans the next days from tomorrow, and reads what was done as history', async () => {
    days = [
      { id: 'd0', plan_id: 'p1', day: '2026-10-11', sessions: [{ id: 'a', topic_id: 't1', kind: 'learn', minutes: 25, done_at: '2026-10-11T10:00:00Z' }] },
      { id: 'd1', plan_id: 'p1', day: '2026-10-12', sessions: [] },
    ]
    const [v] = await load()
    expect(v.upcoming[0].day).toBe('2026-10-13')
    expect(v.upcoming).toHaveLength(7)
    const upcomingKinds = v.schedule.flatMap(d => d.sessions).filter(s => s.topicId === 't1').map(s => s.kind)
    expect(upcomingKinds).not.toContain('learn') // that Learn was done yesterday
    expect(v.schedule[0].day).toBe('2026-10-13')
  })
  it('counts sessions missed in the last 7 days, not today\'s', async () => {
    days = [
      { id: 'd0', plan_id: 'p1', day: '2026-10-10', sessions: [{ id: 'a', topic_id: 't1', kind: 'learn', minutes: 25, done_at: null }, { id: 'b', topic_id: 't2', kind: 'learn', minutes: 25, done_at: '2026-10-10T10:00:00Z' }] },
      { id: 'd1', plan_id: 'p1', day: '2026-10-12', sessions: [{ id: 'c', topic_id: 't1', kind: 'revise', minutes: 15, done_at: null }] },
      { id: 'dOld', plan_id: 'p1', day: '2026-09-01', sessions: [{ id: 'z', topic_id: 't1', kind: 'learn', minutes: 25, done_at: null }] },
    ]
    expect((await load())[0].missed).toBe(1)
  })
  it('hides plans whose exam is done, has no date, or has come', async () => {
    plans = [plan({ exam: { id: 'e1', title: 'M', due_at: '2026-10-26T09:00:00Z', done_at: '2026-10-11T00:00:00Z' } })]
    expect(await load()).toEqual([])
    plans = [plan({ exam: { id: 'e1', title: 'M', due_at: null, done_at: null } })]
    expect(await load()).toEqual([])
    plans = [plan({ exam: { id: 'e1', title: 'M', due_at: '2026-10-12T15:00:00Z', done_at: null } })]
    expect(await load()).toEqual([])
  })
  it('says there are no topics, without saving a day', async () => {
    stats = []
    const [v] = await load()
    expect(v.status).toBe('no_topics')
    expect(v.today).toEqual([])
    expect(ensureDay).not.toHaveBeenCalled()
  })
  it('drops sessions of a topic that no longer exists', async () => {
    days = [{ id: 'd1', plan_id: 'p1', day: '2026-10-12', sessions: [
      { id: 's1', topic_id: 'gone', kind: 'learn', minutes: 25, done_at: null }, { id: 's2', topic_id: 't1', kind: 'learn', minutes: 25, done_at: null },
    ] }]
    expect((await load())[0].today.map(s => s.id)).toEqual(['s2'])
  })
  it('tomorrow is the exam: only today is planned', async () => {
    plans = [plan({ exam: { id: 'e1', title: 'M', due_at: '2026-10-13T09:00:00Z', done_at: null } })]
    const [v] = await load()
    expect(v.upcoming).toEqual([])
    expect(v.today.length).toBeGreaterThan(0)
  })
  it('the days ahead count today\'s planned sessions as done, so a Learn is not shown twice', async () => {
    const [v] = await load()
    const todayStudy = v.today.filter(s => s.kind === 'learn' || s.kind === 'warmup').map(s => s.topic_id)
    expect(todayStudy).toContain('t1')
    for (const day of v.schedule) for (const s of day.sessions) {
      if (todayStudy.includes(s.topicId)) {
        expect(s.kind, `${day.day} ${s.topicName}`).toBe('revise')
        expect(day.day >= '2026-10-14', `${day.day} is at least 2 days after today`).toBe(true)
      }
    }
  })
  it('hides a plan whose exam task is no longer an exam of that course', async () => {
    plans = [plan({ exam: { id: 'e1', title: 'M', due_at: '2026-10-26T09:00:00Z', done_at: null, type: 'assignment', course_id: 'c1' } })]
    expect(await load()).toEqual([])
    plans = [plan({ exam: { id: 'e1', title: 'M', due_at: '2026-10-26T09:00:00Z', done_at: null, type: 'exam', course_id: 'other' } })]
    expect(await load()).toEqual([])
  })
})
