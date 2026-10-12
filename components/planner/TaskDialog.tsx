'use client'
import { useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { endOfLocalDay, localDayKey } from '@/lib/dates'
import type { NewTask } from '@/lib/data/tasks'
import type { Course, Priority, Task, TaskType } from '@/lib/types'

type Props = {
  open: boolean; initial: Partial<Task> | null; courses: Course[]; tz: string
  onClose: () => void; onSave: (input: NewTask) => void; onDelete?: () => void; onDone?: () => void
}

// Adds a task or edits one: used by the planner list and by the calendar's Add menu and deadline chips
export function TaskDialog({ open, initial, courses, tz, onClose, onSave, onDelete, onDone }: Props) {
  const editing = !!initial?.id
  return (
    <Dialog open={open} onClose={onClose} title={editing ? 'Edit task' : initial?.type === 'exam' ? 'Add exam' : 'Add task'}>
      {/* Keyed so each opening starts from `initial` without syncing state in an effect */}
      {open && <TaskForm key={JSON.stringify(initial)} initial={initial} courses={courses} tz={tz} onClose={onClose} onSave={onSave} onDelete={onDelete} onDone={onDone} />}
    </Dialog>
  )
}

function TaskForm({ initial, courses, tz, onClose, onSave, onDelete, onDone }: Omit<Props, 'open'>) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [type, setType] = useState<TaskType>(initial?.type ?? 'other')
  const [courseId, setCourseId] = useState(initial?.course_id ?? '')
  const [date, setDate] = useState(initial?.due_at ? localDayKey(initial.due_at, tz) : '')
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? 'normal')
  const [error, setError] = useState<string | null>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Give it a title.'); return }
    onSave({ title: title.trim(), type, course_id: courseId || null, due_at: date ? endOfLocalDay(date, tz).toISOString() : null, priority })
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="field"><span>Title</span><input value={title} onChange={e => { setTitle(e.target.value); setError(null) }} placeholder="Calc problem set" autoFocus /></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="field"><span>Type</span>
          <select value={type} onChange={e => setType(e.target.value as TaskType)}>
            <option value="other">Task</option><option value="assignment">Assignment</option>
            <option value="exam">Exam</option><option value="reading">Reading</option>
          </select>
        </label>
        <label className="field"><span>Priority</span>
          <select value={priority} onChange={e => setPriority(e.target.value as Priority)}>
            <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option>
          </select>
        </label>
        <label className="field"><span>Course</span>
          <select value={courseId} onChange={e => setCourseId(e.target.value)}>
            <option value="">No course</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="field"><span>Due date</span><input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
      </div>
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
