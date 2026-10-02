'use client'
import { Trash2 } from 'lucide-react'
import { CourseDot } from '@/components/ui/CourseDot'
import { formatDue } from '@/lib/dates'
import type { Course, Task } from '@/lib/types'

export function TaskRow({ task, course, tz, now, done, onToggle, onDelete, showType = true }: {
  task: Task; course?: Course; tz: string; now: Date; done?: boolean
  onToggle: () => void; onDelete?: () => void; showType?: boolean
}) {
  return (
    <div className="group flex items-center gap-2.5 border-b border-line py-2">
      <input type="checkbox" checked={!!done} onChange={onToggle} aria-label={`Mark ${task.title} done`} className="size-4 accent-[var(--accent)]" />
      <CourseDot color={course?.color} />
      <span className={`min-w-0 flex-1 truncate ${done ? 'text-muted line-through' : ''}`}>{task.title}</span>
      {showType && task.type !== 'other' && <span className="pill">{task.type}</span>}
      {task.due_at && <span className="text-xs text-muted">{formatDue(task.due_at, tz, now)}</span>}
      {onDelete && (
        <button onClick={onDelete} aria-label={`Delete ${task.title}`} className="btn-ghost opacity-0 group-hover:opacity-100 focus:opacity-100">
          <Trash2 size={14} aria-hidden />
        </button>
      )}
    </div>
  )
}
