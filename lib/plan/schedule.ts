import { addDaysToKey, weekdayOfKey, type DayKey } from '@/lib/dates'
import type { TopicStatus } from '@/lib/topics/types'
import type { DayPlan, PlanMode, PlanSession, PlanTopic, SessionKind } from './types'

export const MINUTES: Record<SessionKind, number> = { warmup: 10, learn: 25, revise: 15 }
const MODE_SHARE: Record<PlanMode, number> = { sprint: 0.4, balanced: 0.8, deep: 1 }
const MIN_SPRINT_TOPICS = 3
const SPACING_DAYS = 2
const RESERVED_DAYS = 2
const MAX_DAYS = 400
const NEED: Record<TopicStatus, number> = { weak: 0, not_started: 1, covered: 2, mastered: 3 }

// Every day from today to the day before the exam, except days off (weekday numbers, 0 is Sunday)
export function studyDays(today: DayKey, examDay: DayKey, daysOff: number[]): DayKey[] {
  const days: DayKey[] = []
  for (let d = today, n = 0; d < examDay && n < MAX_DAYS; d = addDaysToKey(d, 1), n++) {
    if (!daysOff.includes(weekdayOfKey(d))) days.push(d)
  }
  return days
}

const lastTime = (t: PlanTopic) => (t.lastPractised ? new Date(t.lastPractised).getTime() : 0)
// Weak first (lowest percent right first), then not started, then covered, then mastered; among equals the one
// practised longest ago, then the course's own order
const needOrder = (a: PlanTopic, b: PlanTopic) =>
  NEED[a.status] - NEED[b.status]
  || (a.status === 'weak' ? (a.percent ?? 0) - (b.percent ?? 0) : 0)
  || lastTime(a) - lastTime(b)
  || a.position - b.position

const session = (t: PlanTopic, kind: SessionKind): PlanSession => ({ topicId: t.id, kind, minutes: MINUTES[kind] })

function firstPass(t: PlanTopic): PlanSession[] {
  if (t.status === 'covered' || t.status === 'mastered') return [session(t, 'revise')]
  const out: PlanSession[] = []
  if (t.status === 'not_started' && t.hasNote && !t.warmedUp && !t.learned) out.push(session(t, 'warmup'))
  out.push(session(t, t.learned ? 'revise' : 'learn'))
  return out
}

export function buildPlan(o: {
  today: DayKey; examDay: DayKey; mode: PlanMode; minutesPerDay: number; daysOff: number[]; topics: PlanTopic[]
}): { status: 'ok' | 'no_topics' | 'exam_passed' | 'no_days'; days: DayPlan[]; unscheduled: PlanSession[] } {
  const none = (status: 'no_topics' | 'exam_passed' | 'no_days') => ({ status, days: [] as DayPlan[], unscheduled: [] as PlanSession[] })
  if (o.examDay <= o.today) return none('exam_passed')
  if (o.topics.length === 0) return none('no_topics')
  const days = studyDays(o.today, o.examDay, o.daysOff)
  if (days.length === 0) return none('no_days')

  // Which topics, by mode
  const n = o.topics.length
  const want = o.mode === 'deep' ? n : Math.min(n, Math.max(Math.min(MIN_SPRINT_TOPICS, n), Math.ceil(n * MODE_SHARE[o.mode])))
  const chosen = o.topics.filter(t => o.mode === 'deep' || t.status !== 'mastered').sort(needOrder).slice(0, want)

  const reserve = days.length > RESERVED_DAYS ? RESERVED_DAYS : 0
  const early = days.slice(0, days.length - reserve)
  const late = days.slice(days.length - reserve)
  const plan = new Map<DayKey, PlanSession[]>(days.map(d => [d, []]))
  const used = new Map<DayKey, number>(days.map(d => [d, 0]))

  // First day in `candidates` with room (a day always takes at least one session, even a long one)
  function place(s: PlanSession, candidates: DayKey[]): DayKey | null {
    for (const d of candidates) {
      const total = used.get(d)!
      if (total === 0 || total + s.minutes <= o.minutesPerDay) {
        plan.get(d)!.push(s); used.set(d, total + s.minutes)
        return d
      }
    }
    return null
  }

  const unscheduled: PlanSession[] = []
  const learnDay = new Map<string, DayKey>()
  for (const t of chosen) {
    // A topic studied recently is not revised again until 2 days have passed
    const earliest = t.lastStudied ? addDaysToKey(t.lastStudied, SPACING_DAYS) : null
    for (const s of firstPass(t)) {
      const candidates = s.kind === 'revise' && earliest ? early.filter(d => d >= earliest) : early
      if (candidates.length === 0) continue // nothing to place it on because of the spacing: final revision covers it
      const day = place(s, candidates)
      if (!day) unscheduled.push(s)
      else if (s.kind === 'learn') learnDay.set(t.id, day)
    }
  }
  // Revise each Learn again, at least 2 study days later, where there is room
  for (const t of chosen) {
    const at = learnDay.get(t.id)
    if (!at) continue
    const from = early.indexOf(at) + SPACING_DAYS
    if (from < early.length) place(session(t, 'revise'), early.slice(from))
  }
  // Final revision of every chosen topic on the reserved days, as many as fit
  for (const t of chosen) if (late.length) place(session(t, 'revise'), late)

  return { status: 'ok', days: days.map(d => ({ day: d, sessions: plan.get(d)! })), unscheduled }
}
