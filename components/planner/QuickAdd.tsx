'use client'
import { useMemo, useState } from 'react'
import { CalendarDays, Flag } from 'lucide-react'
import { ChoiceChips } from '@/components/ui/ChoiceChips'
import { BTN_SOLID } from '@/components/ui/buttonStyles'
import { parseQuickAdd } from '@/lib/quickAdd'
import { formatDueLong } from '@/lib/dates'
import type { NewTask } from '@/lib/data/tasks'
import type { Course, TaskType } from '@/lib/types'

const TYPE_OPTIONS = [{ value: 'other', label: 'Task' }, { value: 'assignment', label: 'Assignment' }, { value: 'exam', label: 'Exam' }, { value: 'reading', label: 'Reading' }]

export function QuickAdd({ courses, defaultCourseId, tz, onAdd, compact = false, implicitDue, variant = 'inline' }: {
  courses: Course[]; defaultCourseId: string | null; tz: string; onAdd: (t: NewTask) => void; compact?: boolean
  /** 'card': a roomy composer on a card, for the planner; 'inline': the one line used on Home */
  variant?: 'inline' | 'card'
  /** Label for the due date the caller applies when no date is typed (Home uses "Today") */
  implicitDue?: string
}) {
  const [text, setText] = useState('')
  // On a phone the composer is a single line until it is first used: then the course and type choices appear, and stay (a composer that
  // folded away when you tapped elsewhere would move the page under the tap)
  const [used, setUsed] = useState(false)
  const showOptions = used || !!text.trim()
  // undefined = not chosen yet (follow the course filter); null = explicitly "No course"
  const [courseId, setCourseId] = useState<string | null | undefined>(undefined)
  const [type, setType] = useState<TaskType>('other')
  const parsed = useMemo(() => parseQuickAdd(text, tz, new Date()), [text, tz])
  const effectiveCourse = courseId === undefined ? defaultCourseId : courseId
  const courseOptions = [{ value: '', label: 'No course' }, ...courses.map(c => ({ value: c.id, label: c.name, color: c.color }))]
  const dueLabel = parsed.dueAt ? formatDueLong(parsed.dueAt, tz) : implicitDue

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!parsed.title) return
    onAdd({ title: parsed.title, due_at: parsed.dueAt, course_id: effectiveCourse, type, ...(parsed.priority ? { priority: parsed.priority } : {}) })
    setText('')
  }

  if (variant === 'card') {
    return (
      <form onSubmit={submit} onFocus={() => setUsed(true)}
        className="mb-4 rounded-2xl border border-line bg-raised p-2.5 shadow-sm md:p-3">
        <div className="flex items-center gap-2">
          <input aria-label="Add a task" className="min-w-0 flex-1 bg-transparent px-1.5 py-1.5 text-base outline-none placeholder:text-muted" value={text} onChange={e => setText(e.target.value)}
            placeholder="Add a task: Calc problem set fri" />
          <button className={`${BTN_SOLID} shrink-0`} disabled={!text.trim()}>Add</button>
        </div>
        <div className={`mt-2 flex-col gap-2 border-t border-line pt-2.5 md:flex md:flex-row md:flex-wrap md:items-center md:gap-x-4 md:border-0 md:pt-0 ${showOptions ? 'flex' : 'hidden'}`}>
          {!compact && (
            <>
              <ChoiceChips size="sm" label="Course" value={effectiveCourse ?? ''} options={courseOptions} onChange={v => setCourseId(v || null)} className="max-md:no-scrollbar max-md:flex-nowrap max-md:overflow-x-auto" />
              <ChoiceChips size="sm" label="Type" value={type} options={TYPE_OPTIONS} onChange={v => setType(v as TaskType)} className="max-md:no-scrollbar max-md:flex-nowrap max-md:overflow-x-auto" />
            </>
          )}
          {dueLabel && text.trim() && <span className="inline-flex items-center gap-1 text-xs font-medium text-accent" aria-live="polite"><CalendarDays size={13} aria-hidden />Due {dueLabel}</span>}
          {parsed.priority && text.trim() && <span className="inline-flex items-center gap-1 text-xs font-medium text-danger"><Flag size={13} aria-hidden />High priority</span>}
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
          <ChoiceChips size="sm" label="Course" value={effectiveCourse ?? ''} options={courseOptions} onChange={v => setCourseId(v || null)} />
          <ChoiceChips size="sm" label="Type" value={type} options={TYPE_OPTIONS} onChange={v => setType(v as TaskType)} />
        </>
      )}
      <button className="btn" disabled={!text.trim()}>Add</button>
    </form>
  )
}
