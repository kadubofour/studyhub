import { addDaysToKey, localDayKey, localTimeHHMM, weekdayOfKey, type DayKey } from './dates'

export function nextClass<C extends { day_of_week: number; start_time: string }>(
  classes: C[], tz: string, now: Date,
): { cls: C; dayKey: DayKey } | null {
  const todayKey = localDayKey(now, tz)
  const nowHHMM = localTimeHHMM(now, tz)
  for (let off = 0; off <= 7; off++) {
    const key = addDaysToKey(todayKey, off)
    const dow = weekdayOfKey(key)
    const candidates = classes
      .filter(c => c.day_of_week === dow && (off > 0 || c.start_time.slice(0, 5) > nowHHMM))
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
    if (candidates.length) return { cls: candidates[0], dayKey: key }
  }
  return null
}
