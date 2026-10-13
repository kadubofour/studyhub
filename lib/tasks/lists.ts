import { formatInTimeZone } from 'date-fns-tz'
import { addDaysToKey, localDayKey, type DayKey } from '@/lib/dates'
import { boardColumns } from './board'
import type { Task } from '@/lib/types'

export type ListId = 'all' | 'today' | 'upcoming' | 'someday' | 'done'
export const LISTS: { id: ListId; label: string }[] = [
  { id: 'all', label: 'All tasks' }, { id: 'today', label: 'Today' }, { id: 'upcoming', label: 'Upcoming' }, { id: 'someday', label: 'Someday' }, { id: 'done', label: 'Done' },
]

// The open tasks that belong in a list, in the order they are read. (Done tasks come from their own read, not from the open ones.)
export function tasksForList(list: ListId, tasks: Task[], tz: string, now: Date): Task[] {
  const c = boardColumns(tasks, tz, now)
  switch (list) {
    case 'all': return [...c.overdue, ...c.today, ...c.week, ...c.later, ...c.someday]
    case 'today': return [...c.overdue, ...c.today]
    case 'upcoming': return [...c.week, ...c.later]
    case 'someday': return c.someday
    default: return []
  }
}

export function listCounts(tasks: Task[], doneCount: number, tz: string, now: Date): Record<ListId, number> {
  const n = (l: ListId) => tasksForList(l, tasks, tz, now).length
  return { all: n('all'), today: n('today'), upcoming: n('upcoming'), someday: n('someday'), done: doneCount }
}

export type TaskGroup = { key: string; label: string; tone: 'danger' | 'today' | 'normal'; tasks: Task[] }

// Tasks grouped the way a planner reads: what is late, then each day (Today, Tomorrow, then by date), then no date
export function taskGroups(tasks: Task[], tz: string, now: Date): TaskGroup[] {
  const c = boardColumns(tasks, tz, now)
  const today = localDayKey(now, tz)
  const out: TaskGroup[] = []
  if (c.overdue.length) out.push({ key: 'overdue', label: 'Overdue', tone: 'danger', tasks: c.overdue })
  const byDay = new Map<DayKey, Task[]>()
  for (const t of [...c.today, ...c.week, ...c.later]) {
    const k = localDayKey(t.due_at!, tz)
    byDay.set(k, [...(byDay.get(k) ?? []), t])
  }
  for (const [k, list] of byDay) {
    const label = k === today ? 'Today' : k === addDaysToKey(today, 1) ? 'Tomorrow' : formatInTimeZone(new Date(`${k}T12:00:00Z`), 'UTC', 'EEE, MMM d')
    out.push({ key: k, label, tone: k === today ? 'today' : 'normal', tasks: list })
  }
  if (c.someday.length) out.push({ key: 'none', label: 'No date', tone: 'normal', tasks: c.someday })
  return out
}
