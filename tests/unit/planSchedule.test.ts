import { describe, it, expect } from 'vitest'
import { MINUTES, buildPlan, studyDays } from '@/lib/plan/schedule'
import { addDaysToKey, weekdayOfKey } from '@/lib/dates'
import type { PlanMode, PlanSession, PlanTopic } from '@/lib/plan/types'

const TODAY = '2026-10-12' // a Monday
const at = (n: number) => addDaysToKey(TODAY, n)
let seq = 0
const topic = (over: Partial<PlanTopic> = {}): PlanTopic => {
  const i = seq++
  return { id: `t${i}`, name: `Topic ${i}`, position: i, status: 'not_started', percent: null, lastPractised: null, hasNote: true, learned: false, warmedUp: false, lastStudied: null, ...over }
}
const run = (topics: PlanTopic[], over: Partial<Parameters<typeof buildPlan>[0]> = {}) =>
  buildPlan({ today: TODAY, examDay: at(30), mode: 'deep' as PlanMode, minutesPerDay: 60, daysOff: [], topics, ...over })
const all = (r: ReturnType<typeof run>) => r.days.flatMap(d => d.sessions.map(s => ({ ...s, day: d.day })))
const ids = (r: ReturnType<typeof run>) => new Set(all(r).map(s => s.topicId))

describe('study days', () => {
  it('runs from today to the day before the exam, minus days off', () => {
    expect(studyDays(TODAY, at(4), [])).toEqual([at(0), at(1), at(2), at(3)])
    expect(studyDays(TODAY, at(8), [0, 6]).every(d => ![0, 6].includes(weekdayOfKey(d)))).toBe(true)
    expect(studyDays(TODAY, at(8), [0, 6])).toEqual([at(0), at(1), at(2), at(3), at(4), at(7)]) // Mon to Fri, then Mon again; Sat and Sun skipped; exam on Tue
  })
  it('is empty when the exam is today or past', () => {
    expect(studyDays(TODAY, TODAY, [])).toEqual([])
    expect(studyDays(TODAY, at(-3), [])).toEqual([])
  })
})

describe('status', () => {
  it('reports why there is no plan', () => {
    expect(run([topic()], { examDay: TODAY }).status).toBe('exam_passed')
    expect(run([]).status).toBe('no_topics')
    expect(run([topic()], { examDay: at(3), daysOff: [1, 2, 3] }).status).toBe('no_days') // Mon, Tue, Wed all off
    const ok = run([topic()])
    expect(ok.status).toBe('ok')
    expect(ok.days.length).toBe(30)
  })
})

describe('modes', () => {
  const ten = () => Array.from({ length: 10 }, () => topic())
  it('Sprint covers the neediest 40% (at least 3), Balanced 80%, Deep dive all', () => {
    expect(ids(run(ten(), { mode: 'sprint' })).size).toBe(4)
    expect(ids(run(ten(), { mode: 'balanced' })).size).toBe(8)
    expect(ids(run(ten(), { mode: 'deep' })).size).toBe(10)
    expect(ids(run([topic(), topic()], { mode: 'sprint' })).size).toBe(2) // fewer than 3 topics: all of them
    expect(ids(run(Array.from({ length: 5 }, () => topic()), { mode: 'sprint' })).size).toBe(3) // 40% of 5 is 2: at least 3
  })
  it('only Deep dive includes mastered topics', () => {
    const mk = () => [topic({ status: 'mastered' }), topic({ status: 'mastered' }), topic(), topic(), topic()]
    const mastered = (r: ReturnType<typeof run>, list: PlanTopic[]) => list.filter(t => t.status === 'mastered' && ids(r).has(t.id)).length
    let list = mk(); expect(mastered(run(list, { mode: 'balanced' }), list)).toBe(0)
    list = mk(); expect(mastered(run(list, { mode: 'sprint' }), list)).toBe(0)
    list = mk(); expect(mastered(run(list, { mode: 'deep' }), list)).toBe(2)
  })
})

describe('what comes first and which sessions', () => {
  it('orders by need: weak (lowest percent first), then not started, then covered', () => {
    const covered = topic({ status: 'covered' }), fresh = topic(), weakB = topic({ status: 'weak', percent: 50 }), weakA = topic({ status: 'weak', percent: 20 })
    const first = run([covered, fresh, weakB, weakA], { minutesPerDay: 240, examDay: at(10) }).days[0].sessions
    expect(first.map(s => [s.topicId, s.kind])).toEqual([
      [weakA.id, 'learn'], [weakB.id, 'learn'], [fresh.id, 'warmup'], [fresh.id, 'learn'], [covered.id, 'revise'],
    ])
  })
  it('among equals, the longest since practised comes first, then the topic order', () => {
    const recent = topic({ status: 'covered', lastPractised: '2026-10-10T10:00:00Z' }), old = topic({ status: 'covered', lastPractised: '2026-09-01T10:00:00Z' })
    expect(run([recent, old], { examDay: at(10) }).days[0].sessions.map(s => s.topicId)).toEqual([old.id, recent.id])
  })
  it('a Warm-up only for a not-started topic that has a note and has not had one', () => {
    const kinds = (t: PlanTopic) => all(run([t], { examDay: at(10) })).filter(s => s.day === TODAY).map(s => s.kind)
    expect(kinds(topic())).toEqual(['warmup', 'learn'])
    expect(kinds(topic({ hasNote: false }))).toEqual(['learn'])
    expect(kinds(topic({ warmedUp: true }))).toEqual(['learn'])
    expect(kinds(topic({ learned: true, warmedUp: true }))).toEqual(['revise'])
  })
  it('a Learn that was done is not repeated, and a covered topic only gets revision', () => {
    const r = run([topic({ status: 'weak', percent: 30, learned: true }), topic({ status: 'covered' })], { examDay: at(10) })
    expect(all(r).some(s => s.kind === 'learn' || s.kind === 'warmup')).toBe(false)
  })
  it('uses the agreed minutes', () => {
    const s = run([topic()], { examDay: at(10) }).days[0].sessions
    expect(s.map(x => x.minutes)).toEqual([MINUTES.warmup, MINUTES.learn])
    expect([MINUTES.warmup, MINUTES.learn, MINUTES.revise]).toEqual([10, 25, 15])
  })
})

describe('placing sessions', () => {
  it('never puts more in a day than the minutes, except one session on its own', () => {
    const r = run(Array.from({ length: 6 }, () => topic({ hasNote: false })), { minutesPerDay: 60, examDay: at(14) })
    for (const d of r.days) {
      const total = d.sessions.reduce((n, s) => n + s.minutes, 0)
      expect(total <= 60 || d.sessions.length === 1, d.day).toBe(true)
    }
  })
  it('with minutes smaller than a session still schedules one session a day', () => {
    const r = run([topic({ hasNote: false }), topic({ hasNote: false })], { minutesPerDay: 10, examDay: at(6) })
    expect(r.days[0].sessions.map(s => s.kind)).toEqual(['learn'])
    expect(r.days[1].sessions.map(s => s.kind)).toEqual(['learn'])
  })
  it('with one study day everything that fits goes on it', () => {
    const r = run([topic()], { examDay: at(1) })
    expect(r.days).toHaveLength(1)
    expect(r.days[0].sessions.map(s => s.kind)).toEqual(['warmup', 'learn'])
  })
  it('keeps the last two days for final revision of every chosen topic', () => {
    const list = [topic(), topic(), topic()]
    const r = run(list, { examDay: at(10) })
    const last2 = r.days.slice(-2).flatMap(d => d.sessions)
    expect(last2.every(s => s.kind === 'revise')).toBe(true)
    expect(new Set(last2.map(s => s.topicId))).toEqual(new Set(list.map(t => t.id)))
    expect(r.days.slice(0, -2).flatMap(d => d.sessions).some(s => s.kind === 'revise')).toBe(true) // spaced revision earlier
  })
  it('revises a topic at least 2 days after its Learn', () => {
    const t = topic({ status: 'weak', percent: 10 })
    const r = run([t], { examDay: at(14) })
    const learnDay = all(r).find(s => s.kind === 'learn')!.day
    const revises = all(r).filter(s => s.kind === 'revise')
    expect(revises.length).toBeGreaterThan(0)
    expect(revises.every(s => s.day >= addDaysToKey(learnDay, 2))).toBe(true)
  })
  it('does not revise a topic studied today before 2 days have passed', () => {
    const t = topic({ status: 'covered', lastStudied: TODAY })
    const r = run([t], { examDay: at(14) })
    expect(all(r).filter(s => s.topicId === t.id).every(s => s.day >= at(2))).toBe(true)
  })
  it('lists what does not fit, and does not pretend otherwise', () => {
    const list = Array.from({ length: 10 }, () => topic({ hasNote: false }))
    const r = run(list, { minutesPerDay: 30, examDay: at(2) }) // two days, one Learn each
    expect(r.days.flatMap(d => d.sessions)).toHaveLength(2)
    expect(r.unscheduled).toHaveLength(8)
    expect(r.unscheduled.every((s: PlanSession) => s.kind === 'learn')).toBe(true)
  })
  it('skips days off and still fills the others', () => {
    const r = run([topic(), topic()], { examDay: at(8), daysOff: [0, 6] })
    expect(r.days.map(d => d.day)).toEqual([at(0), at(1), at(2), at(3), at(4), at(7)])
  })
})

describe('determinism', () => {
  it('gives the same plan for the same input', () => {
    const list = [topic({ status: 'weak', percent: 20 }), topic(), topic({ status: 'covered' })]
    expect(run(list, { examDay: at(12) })).toEqual(run(list, { examDay: at(12) }))
  })
})
