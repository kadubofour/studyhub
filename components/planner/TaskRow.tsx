'use client'
import { Trash2, FileText, GraduationCap, BookOpenText } from 'lucide-react'
import { CourseTag } from '@/components/ui/CourseTag'
import { DateTile } from '@/components/ui/DateTile'
import type { Course, Task, TaskType } from '@/lib/types'

const TYPE: Partial<Record<TaskType, { icon: typeof FileText; label: string }>> = {
  assignment: { icon: FileText, label: 'Assignment' },
  exam: { icon: GraduationCap, label: 'Exam' },
  reading: { icon: BookOpenText, label: 'Reading' },
}

export function TaskRow({ task, course, tz, now, done, onToggle, onDelete, showType = true }: {
  task: Task; course?: Course; tz: string; now: Date; done?: boolean
  onToggle: () => void; onDelete?: () => void; showType?: boolean
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
        <div className={`truncate ${done ? 'text-muted line-through' : ''}`}>{task.title}</div>
        {(course || type) && (
          <div className="mt-0.5 flex items-center gap-3">
            <CourseTag course={course} />
            {type && <span className="inline-flex items-center gap-1 text-xs text-muted"><type.icon size={12} aria-hidden />{type.label}</span>}
          </div>
        )}
      </div>
      {task.due_at && <DateTile dueAt={task.due_at} tz={tz} now={now} />}
      {onDelete && (
        <button onClick={onDelete} aria-label={`Delete ${task.title}`} className="btn-ghost opacity-0 group-hover:opacity-100 focus:opacity-100">
          <Trash2 size={14} aria-hidden />
        </button>
      )}
    </div>
  )
}
