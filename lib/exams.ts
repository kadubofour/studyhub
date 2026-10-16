import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { addDaysToKey, endOfLocalDay, localDayKey, localTimeHHMM, type DayKey } from './dates'
import type { ExamKind, Task } from './types'

export const EXAM_KINDS: { id: ExamKind; label: string }[] = [
  { id: 'quiz', label: 'Quiz' }, { id: 'test', label: 'Test' }, { id: 'midterm', label: 'Midterm' }, { id: 'final', label: 'Final' },
  { id: 'practical', label: 'Practical' }, { id: 'oral', label: 'Oral' },
]

/** An exam with a time on its day. One due at the very end of the day is how a date with no time yet is kept. */
export const examHasTime = (dueAt: string | null, tz: string): boolean => !!dueAt && localTimeHHMM(new Date(dueAt), tz) !== '23:59'

/** The moment an exam starts: the date and time in the student's own time zone, or the end of that day when the time is not known yet */
export const examDueAt = (date: DayKey, time: string | null, tz: string): string =>
  (time ? fromZonedTime(`${date}T${time}:00`, tz) : endOfLocalDay(date, tz)).toISOString()

/** When an exam ends: its start plus its length. Nothing without a start time or a length. */
export function examEnd(t: Pick<Task, 'due_at' | 'duration_min'>, tz: string): Date | null {
  if (!t.due_at || !t.duration_min || !examHasTime(t.due_at, tz)) return null
  return new Date(new Date(t.due_at).getTime() + t.duration_min * 60_000)
}

export function durationWords(minutes: number): string {
  const h = Math.floor(minutes / 60), m = minutes % 60
  return [h ? `${h} h` : '', m ? `${m} min` : ''].filter(Boolean).join(' ')
}

const kindLabel = (k: ExamKind) => EXAM_KINDS.find(x => x.id === k)!.label

/** A title made from the course and the kind of exam: "Biology midterm" */
export function suggestTitle(courseName: string | undefined, kind: ExamKind | null): string {
  if (!courseName && !kind) return ''
  if (!kind) return `${courseName} exam`
  if (courseName) return `${courseName} ${kindLabel(kind).toLowerCase()}`
  return kind === 'quiz' ? 'Quiz' : kind === 'oral' ? 'Oral exam' : `${kindLabel(kind)} exam`
}

/** "Sat 14 Nov · 14:00 to 16:00 · Hall B": when, how long and where, in one line */
export function examLine(t: Pick<Task, 'due_at' | 'duration_min' | 'location'>, tz: string): string {
  if (!t.due_at) return 'No date yet'
  const day = formatInTimeZone(new Date(t.due_at), tz, 'EEE d MMM')
  const start = examHasTime(t.due_at, tz) ? localTimeHHMM(new Date(t.due_at), tz) : null
  const end = examEnd(t, tz)
  const when = start ? (end ? `${start} to ${localTimeHHMM(end, tz)}` : start) : 'time to be announced'
  return [day, when, t.location].filter(Boolean).join(' · ')
}

/** A quick move to another day (to the end of it) keeps an exam's start time: the same hour and minute on the new day. Other tasks go to the end of the day. */
export function keepTimeOfDay(task: Pick<Task, 'type' | 'due_at'>, endOfNewDay: string | null, tz: string): string | null {
  if (!endOfNewDay) return null
  if (task.type !== 'exam' || !examHasTime(task.due_at, tz)) return endOfNewDay
  return examDueAt(localDayKey(endOfNewDay, tz), localTimeHHMM(new Date(task.due_at!), tz), tz)
}

/** How far away it is, in the student's own days: today, tomorrow, in 12 days, in 7 weeks, or how long ago. On the day itself, once it has started, says so. */
export function countdown(dueAt: string, now: Date, tz: string, durationMin?: number | null): string {
  const a = localDayKey(now, tz), b = localDayKey(dueAt, tz)
  const dir = b > a ? 1 : -1
  let days = 0
  for (let k = a; k !== b && days < 4000; days++) k = addDaysToKey(k, dir)
  days *= dir
  if (days === 0) {
    const start = new Date(dueAt).getTime()
    if (!durationMin || !examHasTime(dueAt, tz) || now.getTime() < start) return 'today'
    return now.getTime() >= start + durationMin * 60_000 ? 'today, over' : 'today, on now'
  }
  if (days === 1) return 'tomorrow'
  if (days === -1) return 'yesterday'
  if (days < 0) return `${-days} days ago`
  if (days >= 42) return `in ${Math.round(days / 7)} weeks`
  return `in ${days} days`
}
