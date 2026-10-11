import { addDaysToKey, type DayKey } from '@/lib/dates'

// What the student did on one local day (from activity_by_day)
export type ActivityDay = { day: DayKey; reviews: number; quizzes: number; focus_minutes: number; tasks_done: number; plan_sessions: number; tutor_messages: number; lectures: number }

// XP per unit and how many units a day can pay for. A focus unit is 5 minutes.
const RULES = {
  reviews: { xp: 1, cap: 50 },
  quizzes: { xp: 10, cap: 5 },
  focus: { xp: 1, cap: 24 },
  tasks: { xp: 5, cap: 10 },
  plans: { xp: 8, cap: 8 },
  tutor: { xp: 2, cap: 10 },
  lectures: { xp: 15, cap: 2 },
}
const BONUS = 20
const LEVEL_STEP = 50

export const GOALS = [
  { key: 'reviews', label: 'Review 10 cards', target: 10 },
  { key: 'focus', label: 'Focus for 25 minutes', target: 25 },
  { key: 'quiz', label: 'Finish a quiz', target: 1 },
] as const
export type GoalKey = (typeof GOALS)[number]['key']

const goalValue = (a: ActivityDay): Record<GoalKey, number> => ({ reviews: a.reviews, focus: a.focus_minutes, quiz: a.quizzes })
const paid = (n: number, r: { xp: number; cap: number }) => Math.min(n, r.cap) * r.xp
const allMet = (a: ActivityDay) => GOALS.every(g => goalValue(a)[g.key] >= g.target)

export function dayXp(a: ActivityDay): number {
  const xp = paid(a.reviews, RULES.reviews) + paid(a.quizzes, RULES.quizzes) + paid(Math.floor(a.focus_minutes / 5), RULES.focus)
    + paid(a.tasks_done, RULES.tasks) + paid(a.plan_sessions, RULES.plans) + paid(a.tutor_messages, RULES.tutor) + paid(a.lectures, RULES.lectures)
  return xp + (allMet(a) ? BONUS : 0)
}

// Level n starts at 50 * (n - 1)^2 XP
const levelStart = (level: number) => LEVEL_STEP * (level - 1) ** 2
export function levelInfo(total: number) {
  const level = Math.floor(Math.sqrt(Math.max(0, total) / LEVEL_STEP)) + 1
  const start = levelStart(level)
  const span = levelStart(level + 1) - start
  const into = total - start
  return { level, into, span, toNext: span - into }
}

export function summarize(days: ActivityDay[], today: DayKey) {
  const xpByDay = new Map(days.map(d => [d.day, dayXp(d)]))
  const total = [...xpByDay.values()].reduce((a, b) => a + b, 0)
  const active = new Set([...xpByDay].filter(([, xp]) => xp > 0).map(([k]) => k))

  let key = active.has(today) ? today : addDaysToKey(today, -1)
  let streak = 0
  while (active.has(key)) { streak++; key = addDaysToKey(key, -1) }
  let best = 0, run = 0, prev: string | null = null
  for (const k of [...active].sort()) {
    run = prev && addDaysToKey(prev, 1) === k ? run + 1 : 1
    best = Math.max(best, run)
    prev = k
  }

  const todayRow = days.find(d => d.day === today)
  const values = todayRow ? goalValue(todayRow) : { reviews: 0, focus: 0, quiz: 0 }
  const goals = GOALS.map(g => ({ key: g.key, label: g.label, target: g.target, value: values[g.key], done: values[g.key] >= g.target }))
  const last14 = Array.from({ length: 14 }, (_, i) => { const k = addDaysToKey(today, i - 13); return { day: k, xp: xpByDay.get(k) ?? 0 } })
  return { total, today: xpByDay.get(today) ?? 0, level: levelInfo(total), streak, best, goals, allDone: goals.every(g => g.done), bonus: BONUS, last14 }
}
export type XpSummary = ReturnType<typeof summarize>
