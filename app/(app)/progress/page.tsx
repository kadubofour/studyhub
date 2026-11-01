'use client'
import { useEffect, useState } from 'react'
import { Flame, Layers, MessagesSquare, Timer } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { QuizScores } from '@/components/progress/QuizScores'
import { TopicsSection } from '@/components/progress/TopicsSection'
import { ProgressHero } from '@/components/progress/ProgressHero'
import { StatTiles } from '@/components/progress/StatTiles'
import { MiniBars } from '@/components/progress/MiniBars'
import { NewNoteButton } from '@/components/quick/NewNoteButton'
import { QuickActions } from '@/components/quick/QuickActions'
import { ShareProgressButton } from '@/components/share/ShareProgress'
import { useXp } from '@/components/xp/useXp'
import { useProfile } from '@/components/providers/ProfileProvider'
import { supabase } from '@/lib/supabase/client'
import { listSessionsSince } from '@/lib/data/focus'
import { listReviewsSince } from '@/lib/data/reviews'
import { dailyMinutes } from '@/lib/streak'
import { countByDay, retention } from '@/lib/stats'
import { addDaysToKey, localDayKey, startOfLocalDay, weekKeysFor } from '@/lib/dates'
import { compareWeeks, fmtCompact, fmtMinutes, headline, weekDots, weekTotals } from '@/lib/progress/summary'
import type { FocusSession, Review } from '@/lib/types'

// How the student is doing, said kindly: a sentence about today, this week day by day, three numbers in plain words, and two
// quiet charts. The streak is the same one the top bar and the Profile show. Topics and quiz scores follow.
export default function ProgressPage() {
  const { profile } = useProfile()
  const tz = profile.timezone
  const [sessions, setSessions] = useState<FocusSession[] | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const { xp } = useXp()

  useEffect(() => {
    const sb = supabase()
    const today = localDayKey(new Date(), tz)
    // eight weeks of focus (a little more) for the weekly totals, and a month of reviews
    Promise.all([
      listSessionsSince(sb, startOfLocalDay(addDaysToKey(today, -63), tz)),
      listReviewsSince(sb, startOfLocalDay(addDaysToKey(today, -30), tz)),
    ]).then(([s, r]) => { setSessions(s); setReviews(r) })
  }, [tz])

  if (!sessions) return null

  const now = new Date()
  const today = localDayKey(now, tz)
  const goal = profile.daily_goal_minutes
  const minutes = dailyMinutes(sessions, tz)
  const todayMinutes = minutes.get(today) ?? 0
  const thisWeek = weekKeysFor(today).reduce((n, k) => n + (minutes.get(k) ?? 0), 0)
  const weeks = weekTotals(today, minutes, 8)
  const lastWeek = weeks[weeks.length - 2]?.minutes ?? 0
  const ret = retention(reviews)
  const reviewsByDay = countByDay(reviews.map(r => r.reviewed_at), tz)
  const last14 = Array.from({ length: 14 }, (_, i) => addDaysToKey(today, i - 13))
  const reviewTotal = last14.reduce((n, k) => n + (reviewsByDay.get(k) ?? 0), 0)
  const reviewsThisWeek = weekKeysFor(today).reduce((n, k) => n + (reviewsByDay.get(k) ?? 0), 0)
  const bestWeek = Math.max(0, ...weeks.map(w => w.minutes))
  const streak = xp?.streak ?? 0
  const text = headline({ streak, goalMinutes: goal, todayMinutes, weekMinutes: thisWeek, totalXp: xp?.total ?? 0 })
  const dayLetter = (k: string) => ['S', 'M', 'T', 'W', 'T', 'F', 'S'][new Date(`${k}T12:00:00Z`).getUTCDay()]

  return (
    <div className="space-y-5">
      <PageHeader title="Progress" actions={<QuickActions label="Quick actions" actions={[
        { label: 'Review cards', icon: Layers, href: '/review' },
        { label: 'Ask the tutor', icon: MessagesSquare, href: '/tutor' },
        { node: <NewNoteButton /> },
        { node: <ShareProgressButton /> },
      ]} />} />

      <ProgressHero xp={xp} headline={text} dots={weekDots(today, minutes, goal)} todayMinutes={todayMinutes} goalMinutes={goal} />

      <StatTiles stats={[
        { label: 'Streak', value: `${streak} ${streak === 1 ? 'day' : 'days'}`, icon: Flame, tone: 'a',
          sub: streak > 0 ? `Your best is ${xp?.best ?? streak}` : 'Study today to start one' },
        { label: 'Focus this week', value: fmtMinutes(thisWeek), icon: Timer, tone: 'b', sub: compareWeeks(thisWeek, lastWeek) },
        { label: 'Cards reviewed this week', value: String(reviewsThisWeek), icon: Layers, tone: 'c',
          sub: ret === null ? 'Review a few to see how much sticks' : `${Math.round(ret * 100)}% remembered this month` },
      ]} />

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="card" aria-label="Focus by week">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3">
            <h2 className="text-sm font-medium">Focus, week by week</h2>
            <span className="text-xs text-muted">{bestWeek > 0 ? `Your best week: ${fmtMinutes(bestWeek)}` : 'Your weeks will fill in here'}</span>
          </div>
          <MiniBars aria={`Focus time for each of the last 8 weeks, oldest first: ${weeks.map(w => `${w.label} ${fmtMinutes(w.minutes)}`).join(', ')}`} values format={fmtCompact}
            bars={weeks.map(w => ({ key: w.start, value: w.minutes, label: w.label, tip: `Week of ${w.label}: ${fmtMinutes(w.minutes)}`, now: w.current }))} />
          <p className="mt-3 text-xs text-muted">Each bar is a week, Monday to Sunday. The last is this week so far.</p>
        </section>
        <section className="card" aria-label="Cards reviewed by day">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3">
            <h2 className="text-sm font-medium">Cards reviewed, last 14 days</h2>
            <span className="text-xs text-muted">{reviewTotal > 0 ? `${reviewTotal} in all` : 'Review a deck to see this fill in'}</span>
          </div>
          <MiniBars aria={`Cards reviewed each day for the last 14 days: ${last14.map(k => `${k}: ${reviewsByDay.get(k) ?? 0}`).join('; ')}`}
            bars={last14.map(k => ({ key: k, value: reviewsByDay.get(k) ?? 0, label: dayLetter(k), tip: `${k}: ${reviewsByDay.get(k) ?? 0}`, now: k === today }))} />
          <p className="mt-3 text-xs text-muted">Each bar is a day; the last is today.</p>
        </section>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:[&>section:only-child]:col-span-2 [&>section]:!mt-0">
        <TopicsSection />
        <QuizScores />
      </div>
    </div>
  )
}
