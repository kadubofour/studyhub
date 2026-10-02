'use client'
import { useMemo, useState } from 'react'
import { parseQuickAdd } from '@/lib/quickAdd'
import { formatDueLong } from '@/lib/dates'
import type { NewTask } from '@/lib/data/tasks'
import type { Course, TaskType } from '@/lib/types'

export function QuickAdd({ courses, defaultCourseId, tz, onAdd, compact = false, implicitDue }: {
  courses: Course[]; defaultCourseId: string | null; tz: string; onAdd: (t: NewTask) => void; compact?: boolean
  /** Label for the due date the caller applies when no date is typed (Home uses "Today") */
  implicitDue?: string
}) {
  const [text, setText] = useState('')
  // undefined = not chosen yet (follow the course filter); null = explicitly "No course"
  const [courseId, setCourseId] = useState<string | null | undefined>(undefined)
  const [type, setType] = useState<TaskType>('other')
  const parsed = useMemo(() => parseQuickAdd(text, tz, new Date()), [text, tz])
  const effectiveCourse = courseId === undefined ? defaultCourseId : courseId
  const dueLabel = parsed.dueAt ? formatDueLong(parsed.dueAt, tz) : implicitDue

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!parsed.title) return
    onAdd({ title: parsed.title, due_at: parsed.dueAt, course_id: effectiveCourse, type })
    setText('')
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2 py-2">
      <input aria-label="Add a task" className="input min-w-0 flex-1" value={text} onChange={e => setText(e.target.value)}
        placeholder="Add a task: Calc problem set fri" />
      {dueLabel && text.trim() && (
        <span className="pill" aria-live="polite">Due {dueLabel}</span>
      )}
      {!compact && (
        <>
          <select aria-label="Course" className="input" value={effectiveCourse ?? ''} onChange={e => setCourseId(e.target.value || null)}>
            <option value="">No course</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select aria-label="Type" className="input" value={type} onChange={e => setType(e.target.value as TaskType)}>
            <option value="other">Task</option><option value="assignment">Assignment</option>
            <option value="exam">Exam</option><option value="reading">Reading</option>
          </select>
        </>
      )}
      <button className="btn" disabled={!text.trim()}>Add</button>
    </form>
  )
}
