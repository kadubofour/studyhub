'use client'
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { QuizScores } from '@/components/progress/QuizScores'
import { TopicsSection } from '@/components/progress/TopicsSection'
import { ProgressSummary } from '@/components/progress/ProgressSummary'
import { NewNoteButton } from '@/components/quick/NewNoteButton'
import { QuickActions } from '@/components/quick/QuickActions'
import { Layers, MessagesSquare, Timer } from 'lucide-react'
import { useXp } from '@/components/xp/useXp'
import { useProfile } from '@/components/providers/ProfileProvider'
import { supabase } from '@/lib/supabase/client'
import { listSessionsSince } from '@/lib/data/focus'
import { listReviewsSince } from '@/lib/data/reviews'
import { computeStreak, dailyMinutes } from '@/lib/streak'
import { countByDay, retention } from '@/lib/stats'
import { addDaysToKey, localDayKey, startOfLocalDay, weekKeysFor } from '@/lib/dates'
import type { FocusSession, Review } from '@/lib/types'

// Heatmap shades in the student's accent colour
const LEVELS = ['var(--surface)', 'color-mix(in srgb, var(--accent-solid) 30%, transparent)', 'color-mix(in srgb, var(--accent-solid) 62%, transparent)', 'var(--accent-solid)']
const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`)

export default function ProgressPage() {
  const { profile } = useProfile()
  const tz = profile.timezone
  const [sessions, setSessions] = useState<FocusSession[] | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const { xp } = useXp()

  useEffect(() => {
    const sb = supabase()
    const today = localDayKey(new Date(), tz)
    // A year back so "best streak" is meaningful; the heatmap shows the last 12 weeks
    Promise.all([
      listSessionsSince(sb, startOfLocalDay(addDaysToKey(today, -365), tz)),
      listReviewsSince(sb, startOfLocalDay(addDaysToKey(today, -30), tz)),
    ]).then(([s, r]) => { setSessions(s); setReviews(r) })
  }, [tz])

  if (!sessions) return null

  const now = new Date()
  const today = localDayKey(now, tz)
  const minutes = dailyMinutes(sessions, tz)
  const streak = computeStreak(sessions, profile.daily_goal_minutes, tz, now)
  const thisWeek = weekKeysFor(today).reduce((n, k) => n + (minutes.get(k) ?? 0), 0)
  const ret = retention(reviews)
  const reviewsByDay = countByDay(reviews.map(r => r.reviewed_at), tz)

  const firstMonday = addDaysToKey(weekKeysFor(today)[0], -7 * 11)
  const weeks = Array.from({ length: 12 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDaysToKey(firstMonday, w * 7 + d)))
  const level = (m: number) => (m <= 0 ? 0 : m < profile.daily_goal_minutes / 2 ? 1 : m < profile.daily_goal_minutes ? 2 : 3)
  const last14 = Array.from({ length: 14 }, (_, i) => addDaysToKey(today, i - 13))
  const maxReviews = Math.max(1, ...last14.map(k => reviewsByDay.get(k) ?? 0))

  const focusTotal = weeks.flat().reduce((n, k) => n + (k > today ? 0 : minutes.get(k) ?? 0), 0)
  const reviewTotal = last14.reduce((n, k) => n + (reviewsByDay.get(k) ?? 0), 0)

  return (
    <div className="space-y-6">
      <PageHeader title="Progress" />
      <ProgressSummary xp={xp} stats={[
        { label: 'Current streak', value: `${streak.current} ${streak.current === 1 ? 'day' : 'days'}` },
        { label: 'Best streak', value: `${streak.best} ${streak.best === 1 ? 'day' : 'days'}` },
        { label: 'Focus this week', value: fmtMin(thisWeek) },
        { label: 'Retention (30 days)', value: ret === null ? '—' : `${Math.round(ret * 100)}%` },
      ]} />
      {/* phones have no sidebar, so the shortcuts stay there */}
      <div className="md:hidden"><QuickActions label="Quick actions" actions={[
        { label: 'Start focus', icon: Timer, href: '/focus' },
        { label: 'Review cards', icon: Layers, href: '/review' },
        { label: 'Ask the tutor', icon: MessagesSquare, href: '/tutor' },
        { node: <NewNoteButton /> },
      ]} /></div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <section className="card">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-medium">Focus, last 12 weeks</h2>
            <span className="text-xs text-muted">{fmtMin(focusTotal)} in all</span>
          </div>
          <div className="grid grid-cols-12 gap-1" role="img" aria-label="Daily focus time heatmap for the last 12 weeks">
            {weeks.map((days, i) => (
              <div key={i} className="grid gap-1">
                {days.map(k => (
                  <div key={k} title={`${k}: ${fmtMin(minutes.get(k) ?? 0)}`} className="h-6 w-full rounded-md"
                    style={{ background: k > today ? 'transparent' : LEVELS[level(minutes.get(k) ?? 0)] }} />
                ))}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">Darkest = daily goal reached</p>
        </section>
        <section className="card">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-medium">Cards reviewed, last 14 days</h2>
            <span className="text-xs text-muted">{reviewTotal} in all</span>
          </div>
          <div className="flex h-36 items-end gap-1.5">
            {last14.map(k => {
              const n = reviewsByDay.get(k) ?? 0
              return (
                <div key={k} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${k}: ${n}`}>
                  <div className="w-full rounded-md bg-accent-solid" style={{ height: `${(n / maxReviews) * 100}%`, minHeight: n ? 2 : 0 }} />
                  <span className="text-[10px] text-muted">{Number(k.slice(8))}</span>
                </div>
              )
            })}
          </div>
        </section>
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:[&>section:only-child]:col-span-2 [&>section]:!mt-0">
        <TopicsSection />
        <QuizScores />
      </div>
    </div>
  )
}
