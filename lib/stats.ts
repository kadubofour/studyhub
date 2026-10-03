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
// Quiz scores per course for Progress: oldest → newest, as whole percentages, last 10 per course
export function quizScoresByCourse(rows: { correct: number; total: number; finished_at: string; quiz_title: string; course_id: string | null }[]) {
  const groups = new Map<string | null, { at: string; percent: number; title: string }[]>()
  for (const r of [...rows].sort((a, b) => a.finished_at.localeCompare(b.finished_at))) {
    const list = groups.get(r.course_id) ?? []
    list.push({ at: r.finished_at, percent: Math.round((r.correct / r.total) * 100), title: r.quiz_title })
    groups.set(r.course_id, list)
  }
  return [...groups].map(([course_id, scores]) => ({ course_id, scores: scores.slice(-10) }))
}
