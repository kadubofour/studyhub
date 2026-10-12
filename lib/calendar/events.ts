import { localDayKey, localTimeHHMM, type DayKey } from '@/lib/dates'
import type { Priority, Task, TaskType } from '@/lib/types'

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }

// How far down the hours shown the current time is, from 0 (top) to 1 (bottom); nothing when it is outside them
export function nowFraction(now: Date, tz: string, startH: number, endH: number): number | null {
  const minutes = toMin(localTimeHHMM(now, tz))
  if (minutes < startH * 60 || minutes >= endH * 60) return null
  return (minutes - startH * 60) / ((endH - startH) * 60)
}

// Side-by-side lanes for classes that overlap in one day: each class's lane and how many lanes its stretch of the day needs
export function classLanes(slots: { id: string; start_time: string; end_time: string }[]): Map<string, { lane: number; lanes: number }> {
  const sorted = [...slots].sort((a, b) => toMin(a.start_time) - toMin(b.start_time) || toMin(a.end_time) - toMin(b.end_time))
  const out = new Map<string, { lane: number; lanes: number }>()
  let cluster: { id: string; lane: number }[] = []
  let laneEnds: number[] = []
  let clusterEnd = -1
  const flush = () => { for (const c of cluster) out.set(c.id, { lane: c.lane, lanes: laneEnds.length }); cluster = []; laneEnds = [] }
  for (const s of sorted) {
    const start = toMin(s.start_time), end = toMin(s.end_time)
    if (cluster.length && start >= clusterEnd) flush()
    let lane = laneEnds.findIndex(e => e <= start)
    if (lane < 0) { lane = laneEnds.length; laneEnds.push(end) } else laneEnds[lane] = end
    cluster.push({ id: s.id, lane })
    clusterEnd = cluster.length === 1 ? end : Math.max(clusterEnd, end)
  }
  flush()
  return out
}

export type DayItem = { kind: 'task' | 'session'; id: string; title: string; type?: TaskType; priority?: Priority; courseId: string | null }

// What goes in a day's all-day strip: the tasks due that day (exams first, then high priority, then by title), then study sessions
export function dayItems(day: DayKey, tasks: Task[], sessions: { id: string; title: string; courseId: string | null }[], tz: string): DayItem[] {
  const rank = (t: Task) => (t.type === 'exam' ? 0 : t.priority === 'high' ? 1 : 2)
  const due = tasks
    .filter(t => !t.done_at && t.due_at && localDayKey(t.due_at, tz) === day)
    .sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
    .map(t => ({ kind: 'task' as const, id: t.id, title: t.title, type: t.type, priority: t.priority, courseId: t.course_id }))
  return [...due, ...sessions.map(s => ({ kind: 'session' as const, id: s.id, title: s.title, courseId: s.courseId }))]
}
