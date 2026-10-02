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

// Visible hour range for the week grid: 07:00–21:00, widened to fit any class outside it.
export function gridHours(classes: { start_time: string; end_time: string }[]): { start: number; end: number } {
  let start = 7, end = 21
  for (const c of classes) {
    const [sh] = c.start_time.split(':').map(Number)
    const [eh, em] = c.end_time.split(':').map(Number)
    start = Math.min(start, sh)
    end = Math.max(end, em > 0 ? eh + 1 : eh)
  }
  return { start, end: Math.min(24, end) }
}
