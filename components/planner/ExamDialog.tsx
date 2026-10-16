'use client'
import { useState } from 'react'
import { GraduationCap } from 'lucide-react'
import { ChoiceChips } from '@/components/ui/ChoiceChips'
import { Dialog } from '@/components/ui/Dialog'
import { localDayKey, localTimeHHMM } from '@/lib/dates'
import { durationWords, EXAM_KINDS, EXAM_LENGTHS, examDueAt, examHasTime, suggestTitle } from '@/lib/exams'
import type { NewTask } from '@/lib/data/tasks'
import type { Course, ExamKind, Task } from '@/lib/types'

type Props = {
  open: boolean; initial: Partial<Task> | null; courses: Course[]; tz: string
  onClose: () => void; onSave: (input: NewTask) => void; onDelete?: () => void; onDone?: () => void
}

// Adds or edits an exam the way exams are planned: which course and what kind, the day and the time it starts, how long it runs, where, what it
// covers and what it counts for. (Tasks have their own, simpler dialog: TaskDialog.)
export function ExamDialog({ open, initial, courses, tz, onClose, onSave, onDelete, onDone }: Props) {
  const editing = !!initial?.id
  return (
    <Dialog open={open} onClose={onClose} title={editing ? 'Edit exam' : 'Add exam'} icon={GraduationCap} size="md"
      subtitle={editing ? undefined : 'When, how long and where, so the calendar and your reminders know.'}>
      {/* Keyed so each opening starts from `initial` without syncing state in an effect */}
      {open && <ExamForm key={JSON.stringify(initial)} initial={initial} courses={courses} tz={tz} onClose={onClose} onSave={onSave} onDelete={onDelete} onDone={onDone} />}
    </Dialog>
  )
}

function ExamForm({ initial, courses, tz, onClose, onSave, onDelete, onDone }: Omit<Props, 'open'>) {
  const existing = !!initial?.id
  const hasTime = examHasTime(initial?.due_at ?? null, tz)
  const [courseId, setCourseId] = useState(initial?.course_id ?? '')
  const [kind, setKind] = useState<ExamKind | ''>(initial?.exam_kind ?? '')
  const [typedTitle, setTypedTitle] = useState<string | null>(initial?.title ?? null) // null: still the suggestion
  const [date, setDate] = useState(initial?.due_at ? localDayKey(initial.due_at, tz) : '')
  const [time, setTime] = useState(initial?.due_at && hasTime ? localTimeHHMM(new Date(initial.due_at), tz) : '09:00') // a day picked on the calendar has no time: nine
  const [noTime, setNoTime] = useState(existing && !hasTime) // an old exam with no time says so; a new one starts with a time to fill in
  const [length, setLength] = useState(initial?.duration_min ? String(initial.duration_min) : '')
  const [where, setWhere] = useState(initial?.location ?? '')
  const [covers, setCovers] = useState(initial?.covers ?? '')
  const [weight, setWeight] = useState(initial?.weight_pct != null ? String(initial.weight_pct) : '')
  const [error, setError] = useState<string | null>(null)

  const courseName = courses.find(c => c.id === courseId)?.name
  const title = typedTitle ?? suggestTitle(courseName, kind || null)
  const lengths = [...new Set([...EXAM_LENGTHS, ...(initial?.duration_min ? [initial.duration_min] : [])])].sort((a, b) => a - b)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (courses.length > 0 && !courseId) { setError('Pick the course this exam is for.'); return }
    if (!title.trim()) { setError('Give it a title, or pick the course and the kind of exam.'); return }
    if (!date) { setError('Pick the day of the exam.'); return }
    if (!noTime && !time) { setError('Pick the time it starts, or say the time is not announced yet.'); return }
    const pct = weight.trim() === '' ? null : Number(weight)
    if (pct !== null && (!Number.isFinite(pct) || pct < 0 || pct > 100)) { setError('What it counts for is a percentage from 0 to 100.'); return }
    onSave({
      title: title.trim(), type: 'exam', course_id: courseId || null, due_at: examDueAt(date, noTime ? null : time, tz), priority: initial?.priority ?? 'normal',
      exam_kind: kind || null, duration_min: length ? Number(length) : null, location: where.trim() || null, covers: covers.trim() || null,
      weight_pct: pct === null ? null : Math.round(pct),
    })
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="field"><span>Course</span>
        {courses.length === 0
          ? <p className="text-sm text-muted">No courses yet. You can add the exam now and give it a course later.</p>
          : <ChoiceChips label="Course" value={courseId} options={courses.map(c => ({ value: c.id, label: c.name, color: c.color }))} onChange={v => { setCourseId(v); setError(null) }} />}
      </div>
      <div className="field"><span>Kind of exam</span>
        <ChoiceChips label="Kind of exam" value={kind} options={EXAM_KINDS.map(k => ({ value: k.id, label: k.label }))} onChange={v => { setKind(v as ExamKind); setError(null) }} />
      </div>
      <label className="field"><span>Title</span>
        <input value={title} maxLength={300} onChange={e => { setTypedTitle(e.target.value === '' ? null : e.target.value); setError(null) }} placeholder="Biology midterm" autoFocus={!existing} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field"><span>Day</span><input type="date" value={date} onChange={e => { setDate(e.target.value); setError(null) }} /></label>
        <label className="field"><span>Starts at</span><input type="time" value={noTime ? '' : time} disabled={noTime} onChange={e => { setTime(e.target.value); setError(null) }} /></label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={noTime} onChange={e => { setNoTime(e.target.checked); setError(null) }} />
        The time has not been announced yet
      </label>
      <div className="field"><span>How long it runs</span>
        <ChoiceChips label="Length" value={length} options={[{ value: '', label: 'Not sure' }, ...lengths.map(m => ({ value: String(m), label: durationWords(m) }))]} onChange={setLength} />
      </div>
      <label className="field"><span>Where</span><input value={where} onChange={e => setWhere(e.target.value)} maxLength={120} placeholder="Hall B, seat 24" /></label>
      <label className="field"><span>What it covers</span>
        <textarea value={covers} onChange={e => setCovers(e.target.value)} maxLength={1000} rows={3} placeholder="Chapters 1 to 5, the enzyme practical" />
      </label>
      <label className="field"><span>Counts for (% of the grade)</span>
        <input type="number" inputMode="numeric" min={0} max={100} value={weight} onChange={e => { setWeight(e.target.value); setError(null) }} placeholder="30" />
      </label>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex justify-between pt-1">
        <div className="flex gap-2">
          {onDelete && initial?.id && <button type="button" className="btn text-danger" onClick={onDelete}>Delete</button>}
          {onDone && initial?.id && <button type="button" className="btn" onClick={onDone}>Mark done</button>}
          {!(initial?.id && (onDelete || onDone)) && <span />}
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn-primary">Save</button>
        </div>
      </div>
    </form>
  )
}
