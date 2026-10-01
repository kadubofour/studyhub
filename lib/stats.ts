import { localDayKey, type DayKey } from './dates'

export function retention(reviews: { rating: number }[]): number | null {
  if (!reviews.length) return null
  return reviews.filter(r => r.rating >= 3).length / reviews.length
}

export function countByDay(isoDates: string[], tz: string): Map<DayKey, number> {
  const m = new Map<DayKey, number>()
  for (const d of isoDates) {
    const k = localDayKey(d, tz)
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}
