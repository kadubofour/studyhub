import type { SupabaseClient } from '@supabase/supabase-js'
import { listTopicLinks, listTopicStats } from '@/lib/data/topics'
import { addDaysToKey, localDayKey, type DayKey } from '@/lib/dates'
import { summariseHistory, toPlanTopics, type DoneSession } from './history'
import { buildPlan } from './schedule'
import { ensureDay, listPlanDays, listPlans, type PlanRow } from './service'
import type { PlanSession, StoredSession } from './types'

export type SessionView = StoredSession & { topicName: string; noteId: string | null }
export type ScheduledView = PlanSession & { topicName: string; noteId: string | null }
export type PlanView = {
  plan: PlanRow; courseId: string; examDay: DayKey; daysToExam: number
  status: 'ok' | 'no_topics' | 'exam_passed' | 'no_days'
  todayDayId: string | null; today: SessionView[]
  upcoming: { day: DayKey; sessions: ScheduledView[] }[] // the next 7 study days after today
  schedule: { day: DayKey; sessions: ScheduledView[] }[] // every study day after today
  unscheduled: number; missed: number
}

const daysBetween = (a: DayKey, b: DayKey) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)

// Everything the plan screens need, worked out from the saved plans, the topics' results and the saved days.
// Today's list is saved the first time the day is opened; later days are always planned fresh.
export async function loadPlans(sb: SupabaseClient, tz: string, now: Date): Promise<PlanView[]> {
  const today = localDayKey(now, tz)
  const tomorrow = addDaysToKey(today, 1)
  const views: PlanView[] = []
  for (const plan of await listPlans(sb)) {
    if (!plan.exam.due_at || plan.exam.done_at) continue
    const examDay = localDayKey(plan.exam.due_at, tz)
    if (examDay <= today) continue

    const [stats, links, saved] = await Promise.all([listTopicStats(sb, plan.course_id), listTopicLinks(sb, plan.course_id), listPlanDays(sb, plan.id)])
    // The newest linked note of each topic, for Warm-ups and Open links
    const noteIds = [...new Set(links.filter(l => l.link.kind === 'note').map(l => l.link.id))]
    const updated = new Map<string, string>()
    if (noteIds.length) {
      const { data } = await sb.from('notes').select('id,updated_at').in('id', noteIds)
      for (const n of (data ?? []) as { id: string; updated_at: string }[]) updated.set(n.id, n.updated_at)
    }
    const noteOf = new Map<string, string>()
    for (const l of links) {
      if (l.link.kind !== 'note') continue
      const cur = noteOf.get(l.topic_id)
      if (!cur || (updated.get(l.link.id) ?? '') > (updated.get(cur) ?? '')) noteOf.set(l.topic_id, l.link.id)
    }
    const names = new Map(stats.map(s => [s.topic_id, s.name]))
    const dress = (s: PlanSession): ScheduledView | null => (names.has(s.topicId) ? { ...s, topicName: names.get(s.topicId)!, noteId: noteOf.get(s.topicId) ?? null } : null)

    const done: DoneSession[] = saved.flatMap(d => d.sessions.filter(s => s.done_at).map(s => ({ topicId: s.topic_id, kind: s.kind, day: d.day })))
    const topics = toPlanTopics(stats, new Set(noteOf.keys()), summariseHistory(done))
    const settings = { examDay, mode: plan.mode, minutesPerDay: plan.minutes_per_day, daysOff: plan.days_off, topics }

    // Today: the saved list, or plan it now and save it (nothing is saved when there is nothing to do yet)
    const full = buildPlan({ today, ...settings })
    let todayRow = saved.find(d => d.day === today) ?? null
    if (!todayRow) {
      const planned = full.days.find(d => d.day === today)?.sessions ?? []
      if (planned.length) todayRow = await ensureDay(sb, plan.id, today, planned.map(s => ({ id: crypto.randomUUID(), topic_id: s.topicId, kind: s.kind, minutes: s.minutes, done_at: null })))
    }
    const todayViews: SessionView[] = (todayRow?.sessions ?? []).flatMap(s =>
      names.has(s.topic_id) ? [{ ...s, topicName: names.get(s.topic_id)!, noteId: noteOf.get(s.topic_id) ?? null }] : [])

    // The days after today, planned from tomorrow with what is known now
    const future = tomorrow < examDay ? buildPlan({ today: tomorrow, ...settings }) : null
    const schedule = (future?.days ?? []).map(d => ({ day: d.day, sessions: d.sessions.flatMap(s => dress(s) ?? []) }))

    const weekAgo = addDaysToKey(today, -7)
    const missed = saved.filter(d => d.day >= weekAgo && d.day < today).reduce((n, d) => n + d.sessions.filter(s => !s.done_at && names.has(s.topic_id)).length, 0)

    views.push({
      plan, courseId: plan.course_id, examDay, daysToExam: daysBetween(today, examDay), status: full.status,
      todayDayId: todayRow?.id ?? null, today: todayViews, upcoming: schedule.slice(0, 7), schedule,
      unscheduled: (future ?? full).unscheduled.length, missed,
    })
  }
  return views
}
