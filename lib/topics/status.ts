import type { TopicStat, TopicStatus } from './types'

// The same numbers as the topic_stats function in supabase/migrations/…_topics.sql (tests/unit/topicStatus.test.ts checks)
export const WINDOW_DAYS = 30
export const MASTERED_MIN_ANSWERS = 10
export const MASTERED_PERCENT = 80
export const WEAK_MIN_ANSWERS = 5
export const WEAK_PERCENT = 60
export const STALE_DAYS = 14
export const MAX_WEAK_SPOTS = 5

export const STATUS_LABEL: Record<TopicStatus, string> = { not_started: 'Not started', covered: 'Covered', weak: 'Weak', mastered: 'Mastered' }

const percent = (s: TopicStat) => (s.answers_30d ? Math.round((s.correct_30d / s.answers_30d) * 100) : null)

// The numbers behind a status, so it is never a black box
export function evidence(s: TopicStat): string {
  if (s.answers_30d > 0) return `${s.answers_30d} ${s.answers_30d === 1 ? 'answer' : 'answers'}, ${percent(s)}% right in the last ${WINDOW_DAYS} days`
  return s.answers_all > 0 ? `Not practised in the last ${WINDOW_DAYS} days` : 'Not practised yet'
}

// Weak topics worst first, then covered topics not practised for a while (oldest first)
export function weakSpots<T extends TopicStat>(rows: T[], now: Date): T[] {
  const weak = rows.filter(r => r.status === 'weak')
    .sort((a, b) => (percent(a) ?? 0) - (percent(b) ?? 0) || b.answers_30d - a.answers_30d)
  const cutoff = now.getTime() - STALE_DAYS * 86_400_000
  const stale = rows.filter(r => r.status === 'covered' && r.last_practised && new Date(r.last_practised).getTime() <= cutoff)
    .sort((a, b) => new Date(a.last_practised!).getTime() - new Date(b.last_practised!).getTime())
  return [...weak, ...stale].slice(0, MAX_WEAK_SPOTS)
}

export function progressLine(rows: TopicStat[]): string {
  const n = (st: TopicStatus) => rows.filter(r => r.status === st).length
  const parts = [`${n('mastered')} of ${rows.length} mastered`]
  if (n('weak')) parts.push(`${n('weak')} weak`)
  if (n('covered')) parts.push(`${n('covered')} covered`)
  return parts.join(' · ')
}
