'use client'
import { useEffect, useState } from 'react'
import { Flame, Trophy, Timer, Brain } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { QuizScores } from '@/components/progress/QuizScores'
import { TopicsSection } from '@/components/progress/TopicsSection'
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

function Stat({ label, value, icon: Icon, color }: { label: string; value: string; icon: typeof Flame; color: string }) {
  return (
    <div className="tile">
      <div className="tile-label"><Icon size={14} style={{ color }} aria-hidden />{label}</div>
      <div className="tile-value">{value}</div>
    </div>
  )
}

export default function ProgressPage() {
  const { profile } = useProfile()
  const tz = profile.timezone
  const [sessions, setSessions] = useState<FocusSession[] | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])

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

  return (
    <div>
      <PageHeader title="Progress" />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={Flame} color="#D85A30" label="Current streak" value={`${streak.current} ${streak.current === 1 ? 'day' : 'days'}`} />
        <Stat icon={Trophy} color="#BA7517" label="Best streak" value={`${streak.best} ${streak.best === 1 ? 'day' : 'days'}`} />
        <Stat icon={Timer} color="var(--accent)" label="Focus this week" value={fmtMin(thisWeek)} />
        <Stat icon={Brain} color="#1D9E75" label="Retention (30 days)" value={ret === null ? '—' : `${Math.round(ret * 100)}%`} />
      </div>
      <section className="card mb-4">
        <h2 className="mb-2 text-sm font-medium">Focus, last 12 weeks</h2>
        <div className="flex gap-[3px] overflow-x-auto" role="img" aria-label="Daily focus time heatmap for the last 12 weeks">
          {weeks.map((days, i) => (
            <div key={i} className="grid gap-[3px]">
              {days.map(k => (
                <div key={k} title={`${k}: ${fmtMin(minutes.get(k) ?? 0)}`} className="size-3.5 rounded-[4px]"
                  style={{ background: k > today ? 'transparent' : LEVELS[level(minutes.get(k) ?? 0)] }} />
              ))}
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">Darkest = daily goal reached</p>
      </section>
      <section className="card">
        <h2 className="mb-2 text-sm font-medium">Cards reviewed, last 14 days</h2>
        <div className="flex h-24 items-end gap-1">
          {last14.map(k => {
            const n = reviewsByDay.get(k) ?? 0
            return (
              <div key={k} className="flex flex-1 flex-col items-center gap-1" title={`${k}: ${n}`}>
                <div className="w-full rounded-md bg-accent-solid" style={{ height: `${(n / maxReviews) * 80}px`, minHeight: n ? 2 : 0 }} />
                <span className="text-[10px] text-muted">{Number(k.slice(8))}</span>
              </div>
            )
          })}
        </div>
      </section>
      <QuizScores />
      <TopicsSection />
    </div>
  )
}
