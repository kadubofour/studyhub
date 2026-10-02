'use client'
import { useMemo, useState } from 'react'
import { parseQuickAdd } from '@/lib/quickAdd'
import { formatDue } from '@/lib/dates'
import type { NewTask } from '@/lib/data/tasks'
import type { Course, TaskType } from '@/lib/types'

export function QuickAdd({ courses, defaultCourseId, tz, onAdd, compact = false }: {
  courses: Course[]; defaultCourseId: string | null; tz: string; onAdd: (t: NewTask) => void; compact?: boolean
}) {
  const [text, setText] = useState('')
  const [courseId, setCourseId] = useState<string | null>(defaultCourseId)
  const [type, setType] = useState<TaskType>('other')
  const parsed = useMemo(() => parseQuickAdd(text, tz, new Date()), [text, tz])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!parsed.title) return
    onAdd({ title: parsed.title, due_at: parsed.dueAt, course_id: courseId ?? defaultCourseId, type })
    setText('')
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2 py-2">
      <input aria-label="Add a task" className="input min-w-0 flex-1" value={text} onChange={e => setText(e.target.value)}
        placeholder="Add a task: Calc problem set fri" />
      {parsed.dueAt && text.trim() && (
        <span className="pill" aria-live="polite">Due {formatDue(parsed.dueAt, tz, new Date())}</span>
      )}
      {!compact && (
        <>
          <select aria-label="Course" className="input" value={courseId ?? defaultCourseId ?? ''} onChange={e => setCourseId(e.target.value || null)}>
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
