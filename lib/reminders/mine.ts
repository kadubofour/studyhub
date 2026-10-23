import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { addDaysToKey, localDayKey, weekdayOfKey, type DayKey } from '@/lib/dates'
import { WINDOW_MIN, type Reminder } from './engine'

// A reminder the student set for themselves (see docs/superpowers/specs/2026-10-30-my-reminders-design.md).
// Its day and time are in the student's own time zone, so "every day at 08:00" stays at 08:00 when the clocks change.
export type Repeat = 'once' | 'daily' | 'weekdays' | 'weekly'
export interface MyReminder { id: string; title: string; day: DayKey; at: string; repeat: Repeat; href?: string | null; link_label?: string | null }

export const REPEATS: { value: Repeat; label: string }[] = [
  { value: 'once', label: 'Once' }, { value: 'daily', label: 'Every day' }, { value: 'weekdays', label: 'Weekdays' }, { value: 'weekly', label: 'Every week' },
]
const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const hhmm = (r: MyReminder) => r.at.slice(0, 5)
const momentOn = (r: MyReminder, day: DayKey, tz: string) => fromZonedTime(`${day}T${hhmm(r)}:00`, tz)

export function occursOn(r: MyReminder, day: DayKey): boolean {
  if (day < r.day) return false
  if (r.repeat === 'once') return day === r.day
  if (r.repeat === 'daily') return true
  const wd = weekdayOfKey(day)
  if (r.repeat === 'weekdays') return wd >= 1 && wd <= 5
  return wd === weekdayOfKey(r.day)
}

/** When it next shows, or null for a one-off whose time has gone */
export function nextOccurrence(r: MyReminder, now: Date, tz: string): Date | null {
  const today = localDayKey(now, tz)
  let day = today < r.day ? r.day : today
  for (let i = 0; i < 8; i++, day = addDaysToKey(day, 1)) {
    if (!occursOn(r, day)) continue
    const m = momentOn(r, day, tz)
    if (m.getTime() >= now.getTime()) return m
    if (r.repeat === 'once') return null
  }
  return null
}

/** What to show now: each reminder whose time on today (or, just after midnight, yesterday) was in the last few minutes */
export function dueMine(rs: MyReminder[], now: Date, tz: string): Reminder[] {
  const today = localDayKey(now, tz)
  const out: Reminder[] = []
  for (const r of rs) for (const day of [addDaysToKey(today, -1), today]) {
    if (!occursOn(r, day)) continue
    const d = now.getTime() - momentOn(r, day, tz).getTime()
    if (d >= 0 && d < WINDOW_MIN * 60_000) out.push({ key: `custom:${r.id}:${day}:${hhmm(r)}`, title: 'Reminder', body: r.title, href: r.href || '/planner?list=reminders' })
  }
  return out
}

export function describeRepeat(r: MyReminder): string {
  return r.repeat === 'weekly' ? `Every ${WEEKDAY[weekdayOfKey(r.day)]}` : REPEATS.find(x => x.value === r.repeat)!.label
}

export function whenLabel(d: Date, tz: string, now: Date): string {
  const day = localDayKey(d, tz)
  const today = localDayKey(now, tz)
  const time = formatInTimeZone(d, tz, 'HH:mm')
  if (day === today) return `Today ${time}`
  if (day === addDaysToKey(today, 1)) return `Tomorrow ${time}`
  return `${formatInTimeZone(d, tz, 'EEE d MMM')} ${time}`
}
