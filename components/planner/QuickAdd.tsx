'use client'
import { useMemo, useState } from 'react'
import { CalendarDays, Flag } from 'lucide-react'
import { BTN_SOLID } from '@/components/ui/buttonStyles'
import { parseQuickAdd } from '@/lib/quickAdd'
import { formatDueLong } from '@/lib/dates'
import type { NewTask } from '@/lib/data/tasks'
import type { Course, TaskType } from '@/lib/types'

export function QuickAdd({ courses, defaultCourseId, tz, onAdd, compact = false, implicitDue, variant = 'inline' }: {
  courses: Course[]; defaultCourseId: string | null; tz: string; onAdd: (t: NewTask) => void; compact?: boolean
  /** 'card': a roomy composer on a card, for the planner; 'inline': the one line used on Home */
  variant?: 'inline' | 'card'
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
    onAdd({ title: parsed.title, due_at: parsed.dueAt, course_id: effectiveCourse, type, ...(parsed.priority ? { priority: parsed.priority } : {}) })
    setText('')
  }

  if (variant === 'card') {
    const pick = 'h-9 cursor-pointer rounded-xl bg-surface px-2.5 text-sm outline-none transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-[var(--accent-solid)]'
    return (
      <form onSubmit={submit} className="mb-4 rounded-2xl border border-line bg-raised p-3 shadow-sm">
        <input aria-label="Add a task" className="w-full bg-transparent px-1 py-1.5 text-base outline-none placeholder:text-muted" value={text} onChange={e => setText(e.target.value)}
          placeholder="Add a task: Calc problem set fri" />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {!compact && (
            <>
              <select aria-label="Course" className={pick} value={effectiveCourse ?? ''} onChange={e => setCourseId(e.target.value || null)}>
                <option value="">No course</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select aria-label="Type" className={pick} value={type} onChange={e => setType(e.target.value as TaskType)}>
                <option value="other">Task</option><option value="assignment">Assignment</option>
                <option value="exam">Exam</option><option value="reading">Reading</option>
              </select>
            </>
          )}
          {dueLabel && text.trim() && <span className="inline-flex items-center gap-1 text-xs font-medium text-accent" aria-live="polite"><CalendarDays size={13} aria-hidden />Due {dueLabel}</span>}
          {parsed.priority && text.trim() && <span className="inline-flex items-center gap-1 text-xs font-medium text-danger"><Flag size={13} aria-hidden />High priority</span>}
          <button className={`${BTN_SOLID} ml-auto`} disabled={!text.trim()}>Add</button>
        </div>
      </form>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2 py-2">
      <input aria-label="Add a task" className="input min-w-0 flex-1" value={text} onChange={e => setText(e.target.value)}
        placeholder="Add a task: Calc problem set fri" />
      {dueLabel && text.trim() && (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-accent" aria-live="polite"><CalendarDays size={13} aria-hidden />Due {dueLabel}</span>
      )}
      {parsed.priority && text.trim() && <span className="inline-flex items-center gap-1 text-xs font-medium text-danger"><Flag size={13} aria-hidden />High priority</span>}
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
