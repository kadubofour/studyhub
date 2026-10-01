'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { COURSE_COLORS } from '@/lib/colors'

export default function OnboardingPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [goalHours, setGoalHours] = useState('2')
  const [course, setCourse] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function finish(skip: boolean) {
    setBusy(true); setError(null)
    const sb = supabase()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { router.replace('/login'); return }
    const patch: Record<string, unknown> = { onboarded: true, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }
    if (!skip) {
      if (name.trim()) patch.display_name = name.trim()
      const h = Number(goalHours)
      if (Number.isFinite(h) && h > 0 && h <= 24) patch.daily_goal_minutes = Math.round(h * 60)
    }
    const { error } = await sb.from('profiles').update(patch).eq('id', user.id)
    if (!error && !skip && course.trim()) {
      await sb.from('courses').insert({ name: course.trim(), color: COURSE_COLORS[0] })
    }
    setBusy(false)
    if (error) { setError('Couldn\'t save. Try again.'); return }
    router.replace('/home')
    router.refresh()
  }

  return (
    <main className="min-h-dvh flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-medium">Let&apos;s set things up</h1>
        <label className="field"><span>What should we call you?</span>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Ama" />
        </label>
        <label className="field"><span>Daily focus goal (hours)</span>
          <input type="number" min="0.25" max="24" step="0.25" value={goalHours} onChange={e => setGoalHours(e.target.value)} />
        </label>
        <label className="field"><span>Your first course</span>
          <input value={course} onChange={e => setCourse(e.target.value)} placeholder="Biology" />
        </label>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex gap-2">
          <button disabled={busy} onClick={() => finish(false)} className="btn-primary flex-1">Continue</button>
          <button disabled={busy} onClick={() => finish(true)} className="btn">Skip</button>
        </div>
      </div>
    </main>
  )
}
