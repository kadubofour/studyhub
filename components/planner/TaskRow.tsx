'use client'
import { Trash2, FileText, Flag, GraduationCap, BookOpenText } from 'lucide-react'
import { CourseTag } from '@/components/ui/CourseTag'
import { DateTile } from '@/components/ui/DateTile'
import type { Course, Task, TaskType } from '@/lib/types'

const TYPE: Partial<Record<TaskType, { icon: typeof FileText; label: string }>> = {
  assignment: { icon: FileText, label: 'Assignment' },
  exam: { icon: GraduationCap, label: 'Exam' },
  reading: { icon: BookOpenText, label: 'Reading' },
}

export function TaskRow({ task, course, tz, now, done, onToggle, onDelete, onEdit, showType = true }: {
  task: Task; course?: Course; tz: string; now: Date; done?: boolean
  onToggle: () => void; onDelete?: () => void; onEdit?: () => void; showType?: boolean
}) {
  const saving = task.id.startsWith('temp-')
  const type = showType ? TYPE[task.type] : undefined
  return (
    <div className="group mb-1.5 flex items-center gap-3 rounded-r-xl border border-l-4 border-line bg-raised py-2 pl-3 pr-2 transition hover:shadow-sm"
      style={{ borderLeftColor: course?.color ?? 'var(--line)' }}>
      <input type="checkbox" checked={!!done} onChange={onToggle} aria-label={`Mark ${task.title} done`}
        disabled={saving} title={saving ? 'Saving…' : undefined}
        className="size-4 shrink-0 accent-[var(--accent-solid)] disabled:opacity-50" />
      <div className="min-w-0 flex-1">
        <div className={`flex items-center gap-1.5 ${done ? 'text-muted line-through' : ''}`}>
          {onEdit
            ? <button type="button" onClick={onEdit} disabled={saving} aria-label={`Edit ${task.title}`} className="min-w-0 truncate text-left hover:text-accent disabled:hover:text-fg">{task.title}</button>
            : <span className="truncate">{task.title}</span>}
          {task.priority === 'high' && !done && <span className="inline-flex shrink-0 items-center text-danger"><Flag size={13} aria-hidden /><span className="sr-only">High priority</span></span>}
        </div>
        {(course || type) && (
          <div className="mt-0.5 flex items-center gap-3">
            <CourseTag course={course} />
            {type && <span className="inline-flex items-center gap-1 text-xs text-muted"><type.icon size={12} aria-hidden />{type.label}</span>}
          </div>
        )}
      </div>
      {task.due_at && <DateTile dueAt={task.due_at} tz={tz} now={now} />}
      {onDelete && (
        <button onClick={onDelete} disabled={saving} aria-label={`Delete ${task.title}`} className="btn-ghost opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:hidden">
          <Trash2 size={14} aria-hidden />
        </button>
      )}
    </div>
  )
}
