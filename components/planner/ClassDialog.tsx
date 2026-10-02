'use client'
import { useEffect, useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import type { ClassKind, ClassSlot, Course } from '@/lib/types'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function ClassDialog({ open, initial, courses, onClose, onSave, onDelete }: {
  open: boolean; initial: Partial<ClassSlot> | null; courses: Course[]
  onClose: () => void; onSave: (input: Omit<ClassSlot, 'id'>) => void; onDelete?: () => void
}) {
  const [courseId, setCourseId] = useState('')
  const [day, setDay] = useState(1)
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('10:00')
  const [location, setLocation] = useState('')
  const [kind, setKind] = useState<ClassKind>('lecture')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setCourseId(initial?.course_id ?? courses[0]?.id ?? '')
    setDay(initial?.day_of_week ?? 1)
    setStart(initial?.start_time?.slice(0, 5) ?? '09:00')
    setEnd(initial?.end_time?.slice(0, 5) ?? '10:00')
    setLocation(initial?.location ?? '')
    setKind(initial?.kind ?? 'lecture')
    setError(null)
  }, [open, initial, courses])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!courseId) { setError('Add a course first.'); return }
    if (end <= start) { setError('End time must be after start time.'); return }
    onSave({ course_id: courseId, day_of_week: day, start_time: start, end_time: end, location: location.trim() || null, kind })
  }

  return (
    <Dialog open={open} onClose={onClose} title={initial?.id ? 'Edit class' : 'Add class'}>
      <form onSubmit={submit} className="space-y-3">
        <label className="field"><span>Course</span>
          <select value={courseId} onChange={e => setCourseId(e.target.value)}>
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="field"><span>Day</span>
            <select value={day} onChange={e => setDay(Number(e.target.value))}>
              {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
          </label>
          <label className="field"><span>Type</span>
            <select value={kind} onChange={e => setKind(e.target.value as ClassKind)}>
              {['lecture', 'lab', 'tutorial', 'seminar', 'other'].map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
          <label className="field"><span>Start</span><input type="time" value={start} onChange={e => { setStart(e.target.value); setError(null) }} /></label>
          <label className="field"><span>End</span><input type="time" value={end} onChange={e => { setEnd(e.target.value); setError(null) }} /></label>
        </div>
        <label className="field"><span>Location</span><input value={location} onChange={e => setLocation(e.target.value)} placeholder="Room B12" /></label>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <p className="text-xs text-muted">Repeats every week.</p>
        <div className="flex justify-between pt-1">
          {onDelete ? <button type="button" className="btn text-danger" onClick={onDelete}>Delete</button> : <span />}
          <div className="flex gap-2">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button className="btn-primary">Save</button>
          </div>
        </div>
      </form>
    </Dialog>
  )
}
