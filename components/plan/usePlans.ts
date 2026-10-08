'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useSaver } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { loadPlans, type PlanView, type SessionView } from '@/lib/plan/load'
import { saveDaySessions } from '@/lib/plan/service'
import type { StoredSession } from '@/lib/plan/types'

const stored = (s: SessionView): StoredSession => ({ id: s.id, topic_id: s.topic_id, kind: s.kind, minutes: s.minutes, done_at: s.done_at })

// The student's active study plans with today's sessions. Ticking a session saves the day's list straight away.
export function usePlans() {
  const { profile } = useProfile()
  const save = useSaver()
  const tz = profile.timezone
  const [views, setViews] = useState<PlanView[] | null>(null)
  const [version, setVersion] = useState(0)
  const latest = useRef<PlanView[] | null>(null) // the newest list, so two quick ticks both count

  useEffect(() => {
    let live = true
    loadPlans(supabase(), tz, new Date()).then(v => { if (live) { latest.current = v; setViews(v) } }).catch(() => { if (live) { latest.current = []; setViews([]) } })
    return () => { live = false }
  }, [tz, version])

  const reload = useCallback(() => setVersion(v => v + 1), [])

  function setDone(planId: string, sessionId: string, done: boolean) {
    const view = latest.current?.find(v => v.plan.id === planId)
    const before = view?.today.find(s => s.id === sessionId)
    if (!view || !view.todayDayId || !before) return
    const dayId = view.todayDayId
    const set = (stamp: string | null) => {
      const next = (latest.current ?? []).map(v => (v.plan.id === planId ? { ...v, today: v.today.map(s => (s.id === sessionId ? { ...s, done_at: stamp } : s)) } : v))
      latest.current = next; setViews(next)
    }
    const stamp = done ? new Date().toISOString() : null
    save(
      () => set(stamp),
      () => set(before.done_at),
      () => saveDaySessions(supabase(), dayId, (latest.current?.find(v => v.plan.id === planId)?.today ?? []).map(stored)),
    )
  }
  return { views, reload, setDone }
}
