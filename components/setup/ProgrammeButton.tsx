'use client'
import { useState } from 'react'
import { GraduationCap } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { useProfile } from '@/components/providers/ProfileProvider'
import { AboutFields, type About } from '@/components/setup/AboutFields'
import { ProgrammeSetup } from '@/components/setup/ProgrammeSetup'
import { supabase } from '@/lib/supabase/client'
import { updateProfile } from '@/lib/data/profile'

// "From my programme": the student's school, programme and year, then the courses suggested for them, from wherever courses are listed.
// existing: the courses they already have; onDone runs when courses were added, so the list can reload.
export function ProgrammeButton({ existing, onDone, className = 'btn' }: { existing: string[]; onDone: () => void; className?: string }) {
  const { profile } = useProfile()
  const [open, setOpen] = useState(false)
  const [about, setAbout] = useState<About>({ school: '', programme: '', year: '' })
  const [step, setStep] = useState<'about' | 'courses'>('about')

  function start() { setAbout({ school: profile.school ?? '', programme: profile.programme ?? '', year: '' }); setStep('about'); setOpen(true) }
  function next(e: React.FormEvent) {
    e.preventDefault()
    if (!about.programme.trim()) return
    // remembered for next time; not needed to go on
    void updateProfile(supabase(), profile.id, { school: about.school.trim() || null, programme: about.programme.trim() }).catch(() => {})
    setStep('courses')
  }

  return (
    <>
      <button type="button" className={className} onClick={start}><GraduationCap size={15} aria-hidden />From my programme</button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Courses for your programme" icon={GraduationCap} size="md"
        subtitle="Tell us where you study and the AI suggests the courses. It can also draft starter notes for each.">
        {open && (step === 'about'
          ? (
            <form onSubmit={next} className="space-y-3">
              <AboutFields value={about} onChange={setAbout} />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
                <button className="btn-primary" disabled={!about.programme.trim()}>Find my courses</button>
              </div>
            </form>
          )
          : <ProgrammeSetup about={about} existing={existing} onDone={n => { setOpen(false); if (n > 0) onDone() }} />)}
      </Dialog>
    </>
  )
}
