import { fromZonedTime } from 'date-fns-tz'
import { addDaysToKey, formatDue, localDayKey, localTimeHHMM, weekdayOfKey } from '@/lib/dates'
import type { ClassSlot, Task } from '@/lib/types'
import type { QuietHours, ReminderPrefs } from './prefs'

/** A reminder is due for this long after its moment, then it is let go: opening the app late does not replay it */
export const WINDOW_MIN = 15

export interface Reminder { key: string; title: string; body: string; href: string }

export interface EngineInput {
  now: Date
  tz: string
  prefs: ReminderPrefs
  /** Open (not finished) tasks */
  tasks: Task[]
  classes: ClassSlot[]
  /** Flashcards due for review now */
  dueCards: number
  todayMinutes: number
  goalMinutes: number
}

export function inQuietHours(now: Date, tz: string, quiet: QuietHours | null): boolean {
  if (!quiet) return false
  const t = localTimeHHMM(now, tz)
  return quiet.from <= quiet.to ? t >= quiet.from && t < quiet.to : t >= quiet.from || t < quiet.to
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const within = (moment: Date, now: Date) => { const d = now.getTime() - moment.getTime(); return d >= 0 && d < WINDOW_MIN * 60_000 }
const before = (moment: Date, minutes: number) => new Date(moment.getTime() - minutes * 60_000)
const at = (dayKey: string, hhmm: string, tz: string) => fromZonedTime(`${dayKey}T${hhmm.slice(0, 5)}:00`, tz)

/**
 * When a reminder's moment falls in quiet hours it is not dropped: it comes just before they begin (a task due at 23:59 is told about at
 * 21:45, a class at 06:30 the evening before). `shifted` says so, because the usual "in 1 hour" would then be wrong.
 */
function momentOutsideQuiet(moment: Date, tz: string, quiet: QuietHours | null): { moment: Date; shifted: boolean } {
  if (!quiet || !inQuietHours(moment, tz, quiet)) return { moment, shifted: false }
  const day = localDayKey(moment, tz)
  const startDay = localTimeHHMM(moment, tz) >= quiet.from ? day : addDaysToKey(day, -1)
  return { moment: before(at(startDay, quiet.from, tz), WINDOW_MIN), shifted: true }
}

function leadWords(minutes: number) {
  if (minutes % 1440 === 0) return plural(minutes / 1440, 'day')
  if (minutes % 60 === 0) return plural(minutes / 60, 'hour')
  return plural(minutes, 'minute')
}

/** What the student should be told about right now. Pure: the caller remembers which keys it has already shown. */
export function dueReminders({ now, tz, prefs, tasks, classes, dueCards, todayMinutes, goalMinutes }: EngineInput): Reminder[] {
  if (!prefs.on || inQuietHours(now, tz, prefs.quiet)) return []
  const out: Reminder[] = []
  const today = localDayKey(now, tz)
  const classesToday = classes.filter(c => c.day_of_week === weekdayOfKey(today))

  for (const t of tasks) {
    if (t.done_at || !t.due_at) continue
    const due = new Date(t.due_at)
    const when = `${formatDue(t.due_at, tz, now)} ${localTimeHHMM(due, tz)}`
    const lead = (minutes: number, exam: boolean) => {
      const m = momentOutsideQuiet(before(due, minutes), tz, prefs.quiet)
      if (!within(m.moment, now)) return
      const title = m.shifted ? (exam ? 'Exam soon' : 'Due soon') : exam ? `Exam in ${leadWords(minutes)}` : minutes === 0 ? 'Due now' : `Due in ${leadWords(minutes)}`
      out.push({ key: `task:${t.id}:${t.due_at}:${minutes}`, title, body: m.shifted ? `${t.title} · ${when}` : t.title, href: '/planner' })
    }
    if (prefs.taskLead !== null) lead(prefs.taskLead, false)
    if (t.type === 'exam' && prefs.examLead !== null) lead(prefs.examLead, true)
  }

  if (prefs.classLead !== null) {
    for (const c of classesToday) {
      const m = momentOutsideQuiet(before(at(today, c.start_time, tz), prefs.classLead), tz, prefs.quiet)
      if (!within(m.moment, now)) continue
      const kind = c.kind[0].toUpperCase() + c.kind.slice(1)
      out.push({ key: `class:${c.id}:${today}:${prefs.classLead}`, title: m.shifted ? 'Class soon' : `Class in ${leadWords(prefs.classLead)}`, body: `${kind} at ${c.start_time.slice(0, 5)}${c.location ? ` · ${c.location}` : ''}`, href: '/planner' })
    }
  }

  if (prefs.cards && dueCards > 0 && within(at(today, prefs.cards, tz), now))
    out.push({ key: `cards:${today}`, title: 'Flashcards to review', body: `${plural(dueCards, 'card')} ${dueCards === 1 ? 'is' : 'are'} due.`, href: '/flashcards' })

  if (prefs.goal && todayMinutes < goalMinutes && within(at(today, prefs.goal, tz), now))
    out.push({ key: `goal:${today}`, title: 'Daily goal', body: `${todayMinutes} of ${goalMinutes} minutes so far. ${goalMinutes - todayMinutes} to go.`, href: '/focus' })

  if (prefs.morning && within(at(today, prefs.morning, tz), now)) {
    const dueToday = tasks.filter(t => !t.done_at && t.due_at && localDayKey(t.due_at, tz) === today).length
    const parts = [dueToday > 0 && `${plural(dueToday, 'task')} due`, classesToday.length > 0 && plural(classesToday.length, 'class', 'classes')].filter(Boolean) as string[]
    if (parts.length) out.push({ key: `plan:${today}`, title: "Today's plan", body: `${parts.join(' and ')} today.`, href: '/home' })
  }
  return out.filter((r, i) => out.findIndex(o => o.key === r.key) === i)
}
