'use client'
import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useProfile } from '@/components/providers/ProfileProvider'
import { plannerProblem, savePlanner, toDrafts, type ClassDraft, type CourseChoice, type PlannerDrafts, type TaskDraft } from '@/lib/scan/planner'
import type { ClassKind, Course, TaskType } from '@/lib/types'
import type { ScanPlannerResult } from '@/lib/ai/scan'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const TASK_TYPES: [TaskType, string][] = [['assignment', 'Assignment'], ['exam', 'Exam'], ['reading', 'Reading'], ['other', 'Other']]
const KINDS: [ClassKind, string][] = [['lecture', 'Lecture'], ['lab', 'Lab'], ['tutorial', 'Tutorial'], ['seminar', 'Seminar'], ['other', 'Other']]
const Unsure = () => <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent">check this</span>
// A course select's value: an existing course id, or "new:<name>" for a course to create
const courseValue = (c: CourseChoice) => (c.kind === 'existing' ? c.id : `new:${c.name}`)
const courseFrom = (value: string): CourseChoice => (value.startsWith('new:') ? { kind: 'new', name: value.slice(4) } : { kind: 'existing', id: value })

// Scanned tasks and weekly classes: edit, untick, fix courses, then save to the planner
export function PlannerReview({ result, courses, onSaved, onScanAgain }: {
  result: ScanPlannerResult; courses: Course[]
  onSaved: (saved: { tasks: number; classes: number; courses: number }) => void; onScanAgain: () => void
}) {
  const { profile } = useProfile()
  const [d, setD] = useState<PlannerDrafts>(() => toDrafts(result, courses))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const savingRef = useRef(false)
  const newNames = [...new Set(d.classes.flatMap(c => (c.course.kind === 'new' ? [c.course.name] : [])))]
  const setTask = (i: number, patch: Partial<TaskDraft>) => setD(x => ({ ...x, tasks: x.tasks.map((t, j) => (j === i ? { ...t, ...patch } : t)) }))
  const setClass = (i: number, patch: Partial<ClassDraft>) => setD(x => ({ ...x, classes: x.classes.map((c, j) => (j === i ? { ...c, ...patch } : c)) }))
  const problem = plannerProblem(d)
  const count = d.tasks.filter(t => t.keep).length + d.classes.filter(c => c.keep).length

  async function save() {
    if (problem || savingRef.current) return
    savingRef.current = true; setSaving(true); setError(null)
    try {
      onSaved(await savePlanner(supabase(), d, profile.timezone, courses))
    } catch {
      setError('Couldn\'t save everything. Check the planner before trying again.')
    } finally {
      savingRef.current = false; setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {d.tasks.length > 0 && (
        <section className="space-y-2">
          <h3 className="section-label">Tasks</h3>
          {d.tasks.map((t, i) => (
            <div key={i} className="grid grid-cols-[auto_1fr] items-start gap-2 rounded-xl border border-line p-2">
              <input type="checkbox" className="mt-2" aria-label={`Keep task ${i + 1}`} checked={t.keep} onChange={e => setTask(i, { keep: e.target.checked })} />
              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <input aria-label={`Task ${i + 1} title`} value={t.title} onChange={e => setTask(i, { title: e.target.value })} />
                <select aria-label={`Task ${i + 1} type`} value={t.type} onChange={e => setTask(i, { type: e.target.value as TaskType })}>
                  {TASK_TYPES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                </select>
                <input type="date" aria-label={`Task ${i + 1} due date`} value={t.due} onChange={e => setTask(i, { due: e.target.value })} />
                {t.unsure && <div><Unsure /></div>}
              </div>
            </div>
          ))}
        </section>
      )}
      {d.classes.length > 0 && (
        <section className="space-y-2">
          <h3 className="section-label">Weekly classes</h3>
          {d.classes.map((c, i) => (
            <div key={i} className="grid grid-cols-[auto_1fr] items-start gap-2 rounded-xl border border-line p-2">
              <input type="checkbox" className="mt-2" aria-label={`Keep class ${i + 1}`} checked={c.keep} onChange={e => setClass(i, { keep: e.target.checked })} />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <select aria-label={`Class ${i + 1} course`} value={courseValue(c.course)} onChange={e => setClass(i, { course: courseFrom(e.target.value) })}>
                  {courses.map(co => <option key={co.id} value={co.id}>{co.name}</option>)}
                  {newNames.map(n => <option key={`new:${n}`} value={`new:${n}`}>Create course {n}</option>)}
                </select>
                <select aria-label={`Class ${i + 1} day`} value={c.day} onChange={e => setClass(i, { day: Number(e.target.value) })}>
                  {DAYS.map((day, n) => <option key={day} value={n}>{day}</option>)}
                </select>
                <select aria-label={`Class ${i + 1} kind`} value={c.kind} onChange={e => setClass(i, { kind: e.target.value as ClassKind })}>
                  {KINDS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                </select>
                <input type="time" aria-label={`Class ${i + 1} start`} value={c.start} onChange={e => setClass(i, { start: e.target.value })} />
                <input type="time" aria-label={`Class ${i + 1} end`} value={c.end} onChange={e => setClass(i, { end: e.target.value })} />
                <input aria-label={`Class ${i + 1} room`} placeholder="Room" value={c.room} onChange={e => setClass(i, { room: e.target.value })} />
                {c.unsure && <div><Unsure /></div>}
              </div>
            </div>
          ))}
        </section>
      )}
      {problem && <p className="text-xs text-muted">{problem}</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex justify-between gap-2">
        <button type="button" className="btn" onClick={onScanAgain}>↺ Scan again</button>
        <button type="button" className="btn-primary" disabled={!!problem || saving} onClick={save}>Save {count} item{count === 1 ? '' : 's'}</button>
      </div>
    </div>
  )
}
