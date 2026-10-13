'use client'
import { useState } from 'react'
import { ChoiceChips } from '@/components/ui/ChoiceChips'
import { Dialog } from '@/components/ui/Dialog'
import type { ClassKind, ClassSlot, Course } from '@/lib/types'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

type Props = {
  open: boolean; initial: Partial<ClassSlot> | null; courses: Course[]
  onClose: () => void; onSave: (input: Omit<ClassSlot, 'id'>) => void; onDelete?: () => void
}

export function ClassDialog({ open, initial, courses, onClose, onSave, onDelete }: Props) {
  return (
    <Dialog open={open} onClose={onClose} title={initial?.id ? 'Edit class' : 'Add class'}>
      {/* Keyed so each opening starts from `initial` without syncing state in an effect */}
      {open && <ClassForm key={JSON.stringify(initial)} initial={initial} courses={courses} onClose={onClose} onSave={onSave} onDelete={onDelete} />}
    </Dialog>
  )
}

function ClassForm({ initial, courses, onClose, onSave, onDelete }: Omit<Props, 'open'>) {
  const [courseId, setCourseId] = useState(initial?.course_id ?? courses[0]?.id ?? '')
  const [day, setDay] = useState(initial?.day_of_week ?? 1)
  const [start, setStart] = useState(initial?.start_time?.slice(0, 5) ?? '09:00')
  const [end, setEnd] = useState(initial?.end_time?.slice(0, 5) ?? '10:00')
  const [location, setLocation] = useState(initial?.location ?? '')
  const [kind, setKind] = useState<ClassKind>(initial?.kind ?? 'lecture')
  const [error, setError] = useState<string | null>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!courseId) { setError('Add a course first.'); return }
    if (end <= start) { setError('End time must be after start time.'); return }
    onSave({ course_id: courseId, day_of_week: day, start_time: start, end_time: end, location: location.trim() || null, kind })
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="field"><span>Course</span>
        <ChoiceChips label="Course" value={courseId} options={courses.map(c => ({ value: c.id, label: c.name, color: c.color }))} onChange={setCourseId} />
      </div>
      <div className="field"><span>Day</span>
        <ChoiceChips label="Day" value={String(day)} options={DAYS.map((d, i) => ({ value: String(i), label: d.slice(0, 3) }))} onChange={v => setDay(Number(v))} size="sm" />
      </div>
      <div className="field"><span>Type</span>
        <ChoiceChips label="Type" value={kind} options={['lecture', 'lab', 'tutorial', 'seminar', 'other'].map(k => ({ value: k, label: k[0].toUpperCase() + k.slice(1) }))} onChange={v => setKind(v as ClassKind)} size="sm" />
      </div>
      <div className="grid grid-cols-2 gap-2">
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
  )
}
