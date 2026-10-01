import { addDaysToKey, localDayKey, type DayKey } from './dates'

export function dailyMinutes(sessions: { started_at: string; minutes: number }[], tz: string): Map<DayKey, number> {
  const m = new Map<DayKey, number>()
  for (const s of sessions) {
    const k = localDayKey(s.started_at, tz)
    m.set(k, (m.get(k) ?? 0) + s.minutes)
  }
  return m
}

export function computeStreak(
  sessions: { started_at: string; minutes: number }[], goalMinutes: number, tz: string, now: Date,
): { current: number; best: number } {
  const goal = Math.max(1, goalMinutes)
  const met = new Set([...dailyMinutes(sessions, tz)].filter(([, m]) => m >= goal).map(([k]) => k))

  const today = localDayKey(now, tz)
  let key = met.has(today) ? today : addDaysToKey(today, -1)
  let current = 0
  while (met.has(key)) { current++; key = addDaysToKey(key, -1) }

  let best = 0, run = 0, prev: string | null = null
  for (const k of [...met].sort()) {
    run = prev && addDaysToKey(prev, 1) === k ? run + 1 : 1
    best = Math.max(best, run)
    prev = k
  }
  return { current, best }
}
