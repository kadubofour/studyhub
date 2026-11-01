import { addDaysToKey, weekKeysFor, weekdayOfKey, type DayKey } from '@/lib/dates'

// What the Progress page says, worked out from the student's numbers: a sentence that meets them where they are, the days of this
// week, and a total for each of the last few weeks. Nothing here scolds: a quiet week is shown as it was, and the way on is always next.

/** 90 minutes as "1h 30m", 120 as "2h", 25 as "25m" */
export const fmtMinutes = (m: number): string => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`)
/** A short form for above a bar: 53 as "53m", 105 as "1.8h", 120 as "2h" */
export const fmtCompact = (m: number): string => (m >= 60 ? `${(Math.round((m / 60) * 10) / 10).toString()}h` : `${m}m`)
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

export type Headline = { title: string; line: string }

/** One warm sentence and a line on what would help next, from the streak, today's focus and the week's */
export function headline(o: { streak: number; goalMinutes: number; todayMinutes: number; weekMinutes: number; totalXp: number }): Headline {
  const { streak, goalMinutes, todayMinutes, weekMinutes, totalXp } = o
  const left = Math.max(0, goalMinutes - todayMinutes)
  // how much is left of today's goal, said only when there is a goal and some of it is done
  const toGoal = goalMinutes > 0 && todayMinutes > 0 ? `${fmtMinutes(left)} more of focus reaches today's goal.` : null
  if (goalMinutes > 0 && todayMinutes >= goalMinutes) {
    return { title: 'Today\'s goal is done.', line: streak > 1 ? `${plural(streak, 'day')} in a row. Nice work.` : 'Nice work. Come back tomorrow to start a streak.' }
  }
  if (streak >= 2) {
    return { title: `${streak} days in a row. Keep it going.`, line: toGoal ?? 'A short focus session today keeps your streak alive.' }
  }
  if (streak === 1) {
    return { title: 'Day one of a streak.', line: toGoal ?? 'Come back tomorrow to make it two.' }
  }
  if (weekMinutes > 0 || totalXp > 0) {
    return { title: weekMinutes > 0 ? `${fmtMinutes(weekMinutes)} of focus this week.` : 'You have made a start.', line: 'A short session today begins a new streak.' }
  }
  return { title: 'Your first session starts it all.', line: 'Even 10 minutes counts. Pick one small thing to begin with.' }
}

export type WeekDot = { key: DayKey; letter: string; name: string; state: 'met' | 'some' | 'none' | 'future'; isToday: boolean; minutes: number }
const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** This week, Monday first: the days the daily goal was reached, the days with some focus, and the days still to come */
export function weekDots(today: DayKey, minutesByDay: Map<DayKey, number>, goalMinutes: number): WeekDot[] {
  return weekKeysFor(today).map(key => {
    const minutes = minutesByDay.get(key) ?? 0
    const dow = weekdayOfKey(key)
    const state = key > today ? 'future' : goalMinutes > 0 && minutes >= goalMinutes ? 'met' : minutes > 0 ? 'some' : 'none'
    return { key, letter: LETTERS[dow], name: NAMES[dow], state, isToday: key === today, minutes }
  })
}

export type WeekTotal = { start: DayKey; minutes: number; label: string; current: boolean }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const shortDate = (k: DayKey) => `${Number(k.slice(8))} ${MONTHS[Number(k.slice(5, 7)) - 1]}`

/** The focus minutes of each of the last `n` weeks (Monday to Sunday), oldest first, the last being this week */
export function weekTotals(today: DayKey, minutesByDay: Map<DayKey, number>, n = 8): WeekTotal[] {
  const thisMonday = weekKeysFor(today)[0]
  return Array.from({ length: n }, (_, i) => {
    const start = addDaysToKey(thisMonday, -7 * (n - 1 - i))
    const minutes = weekKeysFor(start).reduce((sum, k) => sum + (k <= today ? minutesByDay.get(k) ?? 0 : 0), 0)
    return { start, minutes, label: shortDate(start), current: i === n - 1 }
  })
}

/** How this week compares with last, only ever kindly: more is celebrated, less just shows last week's number */
export function compareWeeks(thisWeek: number, lastWeek: number): string {
  if (thisWeek === 0 && lastWeek === 0) return 'Nothing yet this week'
  if (lastWeek === 0) return 'A fresh start this week'
  if (thisWeek > lastWeek) return `${fmtMinutes(thisWeek - lastWeek)} more than last week`
  if (thisWeek === lastWeek) return 'The same as last week'
  return `Last week: ${fmtMinutes(lastWeek)}`
}
