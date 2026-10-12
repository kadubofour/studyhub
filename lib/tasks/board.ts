import { addDaysToKey, bucketTasks, endOfLocalDay, localDayKey, weekKeysFor } from '@/lib/dates'
import type { Task } from '@/lib/types'

export type BoardColumns = { overdue: Task[]; today: Task[]; week: Task[]; later: Task[]; someday: Task[] }
export type MoveChoice = 'today' | 'tomorrow' | 'nextweek' | 'none'

// The open tasks sorted into the board's columns: late, today, the rest of this week (to Sunday), later, and no date
export function boardColumns(tasks: Task[], tz: string, now: Date): BoardColumns {
  const b = bucketTasks(tasks, tz, now)
  const sunday = weekKeysFor(localDayKey(now, tz))[6]
  return {
    overdue: b.overdue,
    today: b.today,
    week: b.upcoming.filter(t => localDayKey(t.due_at!, tz) <= sunday),
    later: b.upcoming.filter(t => localDayKey(t.due_at!, tz) > sunday),
    someday: b.noDate,
  }
}

// One line over the board: what needs attention
export function boardSummary(c: BoardColumns): string {
  const parts: string[] = []
  if (c.overdue.length) parts.push(`${c.overdue.length} overdue`)
  if (c.today.length) parts.push(`${c.today.length} due today`)
  if (c.week.length) parts.push(parts.length ? `${c.week.length} more this week` : `${c.week.length} due this week`)
  return parts.length ? parts.join(' · ') : 'Nothing due this week'
}

// The due time a quick move gives a task: the end of that day in the student's time zone, or none
export function rescheduleTo(choice: MoveChoice, tz: string, now: Date): string | null {
  if (choice === 'none') return null
  const days = { today: 0, tomorrow: 1, nextweek: 7 }[choice]
  return endOfLocalDay(addDaysToKey(localDayKey(now, tz), days), tz).toISOString()
}
