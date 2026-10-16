'use client'
import { useState } from 'react'
import { ChoiceChips } from '@/components/ui/ChoiceChips'
import { Dialog } from '@/components/ui/Dialog'
import { ExamDialog } from './ExamDialog'
import { endOfLocalDay, localDayKey } from '@/lib/dates'
import type { NewTask } from '@/lib/data/tasks'
import type { Course, Priority, Task, TaskType } from '@/lib/types'

type Props = {
  open: boolean; initial: Partial<Task> | null; courses: Course[]; tz: string
  onClose: () => void; onSave: (input: NewTask) => void; onDelete?: () => void; onDone?: () => void
}

// Adds a task or edits one: used by the planner list and by the calendar's Add menu and deadline chips. An exam is not a task to fill in here: it has
// its own dialog (ExamDialog), because it needs a time, a length, a place and what it covers.
export function TaskDialog(props: Props) {
  // Both stay in the page and only the right one is open, so closing one hands focus back to what opened it
  const exam = props.initial?.type === 'exam'
  return (
    <>
      <ExamDialog {...props} open={props.open && exam} />
      <TaskDialogBox {...props} open={props.open && !exam} />
    </>
  )
}

function TaskDialogBox({ open, initial, courses, tz, onClose, onSave, onDelete, onDone }: Props) {
  const editing = !!initial?.id
  return (
    <Dialog open={open} onClose={onClose} title={editing ? 'Edit task' : 'Add task'}>
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
      <div className="field"><span>Type</span>
        <ChoiceChips label="Type" value={type} options={[{ value: 'other', label: 'Task' }, { value: 'assignment', label: 'Assignment' }, { value: 'reading', label: 'Reading' }]} onChange={v => setType(v as TaskType)} />
      </div>
      <div className="field"><span>Priority</span>
        <ChoiceChips label="Priority" value={priority} options={[{ value: 'low', label: 'Low' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }]} onChange={v => setPriority(v as Priority)} />
      </div>
      <div className="field"><span>Course</span>
        <ChoiceChips label="Course" value={courseId} options={[{ value: '', label: 'No course' }, ...courses.map(c => ({ value: c.id, label: c.name, color: c.color }))]} onChange={setCourseId} />
      </div>
      <label className="field"><span>Due date</span><input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
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
