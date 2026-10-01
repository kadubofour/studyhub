import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'

export type DayKey = string

export function localDayKey(d: Date | string, tz: string): DayKey {
  return formatInTimeZone(new Date(d), tz, 'yyyy-MM-dd')
}

export function startOfLocalDay(key: DayKey, tz: string): Date {
  return fromZonedTime(`${key}T00:00:00`, tz)
}

export function endOfLocalDay(key: DayKey, tz: string): Date {
  return fromZonedTime(`${key}T23:59:59`, tz)
}

export function addDaysToKey(key: DayKey, n: number): DayKey {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

export function weekdayOfKey(key: DayKey): number {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function localTimeHHMM(d: Date, tz: string): string {
  return formatInTimeZone(d, tz, 'HH:mm')
}

export function bucketTasks<T extends { due_at: string | null; done_at: string | null }>(
  tasks: T[], tz: string, now: Date,
) {
  const todayKey = localDayKey(now, tz)
  const out = { overdue: [] as T[], today: [] as T[], upcoming: [] as T[], noDate: [] as T[] }
  for (const task of tasks) {
    if (task.done_at) continue
    if (!task.due_at) { out.noDate.push(task); continue }
    const key = localDayKey(task.due_at, tz)
    if (key < todayKey) out.overdue.push(task)
    else if (key === todayKey) out.today.push(task)
    else out.upcoming.push(task)
  }
  const byDue = (a: T, b: T) => (a.due_at ?? '').localeCompare(b.due_at ?? '')
  out.overdue.sort(byDue); out.today.sort(byDue); out.upcoming.sort(byDue)
  return out
}

export function formatDue(dueAt: string, tz: string, now: Date): string {
  const todayKey = localDayKey(now, tz)
  const key = localDayKey(dueAt, tz)
  if (key === todayKey) return 'Today'
  if (key === addDaysToKey(todayKey, 1)) return 'Tomorrow'
  if (key > todayKey && key <= addDaysToKey(todayKey, 6)) return formatInTimeZone(new Date(dueAt), tz, 'EEE')
  return formatInTimeZone(new Date(dueAt), tz, 'MMM d')
}

export function weekKeysFor(key: DayKey): DayKey[] {
  const monday = addDaysToKey(key, -((weekdayOfKey(key) + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => addDaysToKey(monday, i))
}
