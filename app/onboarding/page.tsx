'use client'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { COURSE_COLORS } from '@/lib/colors'
import { safeNext } from '@/lib/safeNext'
import { AboutFields, type About } from '@/components/setup/AboutFields'
import { ProgrammeSetup } from '@/components/setup/ProgrammeSetup'

function Onboarding() {
  const router = useRouter()
  const next = safeNext(useSearchParams().get('next'))
  const [name, setName] = useState('')
  const [goalHours, setGoalHours] = useState('2')
  const [about, setAbout] = useState<About>({ school: '', programme: '', year: '' })
  const [course, setCourse] = useState('')
  const [step, setStep] = useState<'you' | 'courses'>('you')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const leave = () => { router.replace(next); router.refresh() }

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
      if (about.school.trim()) patch.school = about.school.trim()
      if (about.programme.trim()) patch.programme = about.programme.trim()
    }
    let { error } = await sb.from('profiles').update(patch).eq('id', user.id)
    if (error) {
      // The database rejects zone names it doesn't know; keep the signup zone rather than block onboarding
      delete patch.timezone
      ;({ error } = await sb.from('profiles').update(patch).eq('id', user.id))
    }
    if (!error && !skip && course.trim()) {
      await sb.from('courses').insert({ name: course.trim(), color: COURSE_COLORS[0] })
    }
    setBusy(false)
    if (error) { setError('Couldn\'t save. Try again.'); return }
    // With a programme, the courses for it come next; without, that is all
    if (!skip && about.programme.trim()) { setStep('courses'); return }
    leave()
  }

  return (
    <main className="min-h-dvh flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm space-y-4">
        {step === 'you' ? (
          <>
            <h1 className="text-xl font-medium">Let&apos;s set things up</h1>
            <label className="field"><span>What should we call you?</span>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Ama" />
            </label>
            <label className="field"><span>Daily focus goal (hours)</span>
              <input type="number" min="0.25" max="24" step="0.25" value={goalHours} onChange={e => setGoalHours(e.target.value)} />
            </label>
            <div className="space-y-3 rounded-2xl bg-raised p-4">
              <div>
                <h2 className="text-[15px] font-semibold">Where do you study?</h2>
                <p className="text-[13px] text-muted">Add your programme and we suggest its courses, and can write starter notes for them.</p>
              </div>
              <AboutFields value={about} onChange={setAbout} />
            </div>
            <label className="field"><span>Your first course</span>
              <input value={course} onChange={e => setCourse(e.target.value)} placeholder="Biology" />
            </label>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <div className="flex gap-2">
              <button disabled={busy} onClick={() => finish(false)} className="btn-primary flex-1">Continue</button>
              <button disabled={busy} onClick={() => finish(true)} className="btn">Skip</button>
            </div>
          </>
        ) : (
          <ProgrammeSetup about={about} existing={course.trim() ? [course.trim()] : []} onDone={leave} />
        )}
      </div>
    </main>
  )
}

export default function OnboardingPage() {
  return <Suspense><Onboarding /></Suspense>
}
