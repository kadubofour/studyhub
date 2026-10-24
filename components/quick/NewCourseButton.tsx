'use client'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { COURSE_COLORS } from '@/lib/colors'
import { createCourse } from '@/lib/data/courses'
import { supabase } from '@/lib/supabase/client'
import type { Course } from '@/lib/types'

// Adds a course from wherever courses are listed: a name and a colour, then it joins the list (onAdded)
export function NewCourseButton({ count, onAdded, className = 'btn-primary' }: { count: number; onAdded: (c: Course) => void; className?: string }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(COURSE_COLORS[0])
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  function start() { setName(''); setColor(COURSE_COLORS[count % COURSE_COLORS.length]); setFailed(false); setOpen(true) }
  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true); setFailed(false)
    try {
      onAdded(await createCourse(supabase(), { name: name.trim(), color }))
      setOpen(false)
    } catch { setFailed(true) } finally { setBusy(false) }
  }

  return (
    <>
      <button type="button" className={className} onClick={start}><Plus size={15} aria-hidden />New course</button>
      <Dialog open={open} onClose={() => setOpen(false)} title="New course">
        <form onSubmit={save} className="space-y-3">
          <label className="field"><span>Name</span><input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Biology" /></label>
          <div className="flex gap-2" role="radiogroup" aria-label="Color">
            {COURSE_COLORS.map(c => (
              <button type="button" key={c} role="radio" aria-checked={color === c} aria-label={c} onClick={() => setColor(c)}
                className={`size-6 rounded-full ${color === c ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : ''}`} style={{ background: c }} />
            ))}
          </div>
          {failed && <p role="alert" className="text-sm text-danger">Couldn&apos;t add the course. Check your connection and try again.</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={busy}>Add course</button>
          </div>
        </form>
      </Dialog>
    </>
  )
}
