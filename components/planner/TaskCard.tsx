'use client'
import { useEffect, useRef, useState } from 'react'
import { CalendarClock, Flag, FileText, GraduationCap, BookOpenText, Trash2 } from 'lucide-react'
import { CourseTag } from '@/components/ui/CourseTag'
import { BTN_ICON } from '@/components/ui/buttonStyles'
import { formatDue, localDayKey } from '@/lib/dates'
import type { MoveChoice } from '@/lib/tasks/board'
import type { Course, Task, TaskType } from '@/lib/types'

const TYPE: Partial<Record<TaskType, { icon: typeof FileText; label: string }>> = {
  assignment: { icon: FileText, label: 'Assignment' },
  exam: { icon: GraduationCap, label: 'Exam' },
  reading: { icon: BookOpenText, label: 'Reading' },
}
const MOVES: { id: MoveChoice; label: string }[] = [{ id: 'today', label: 'Today' }, { id: 'tomorrow', label: 'Tomorrow' }, { id: 'nextweek', label: 'Next week' }, { id: 'none', label: 'No date' }]

// One task as a row in a group: a round tick, the title (opens it), course and type, when it is due. Move and delete appear on hover or focus.
export function TaskCard({ task, course, tz, now, onToggle, onEdit, onMove, onDelete }: {
  task: Task; course?: Course; tz: string; now: Date; onToggle: () => void; onEdit: () => void; onMove: (to: MoveChoice) => void; onDelete?: () => void
}) {
  const saving = task.id.startsWith('temp-')
  const type = TYPE[task.type]
  const overdue = !!task.due_at && localDayKey(task.due_at, tz) < localDayKey(now, tz)
  const [menu, setMenu] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menu) return
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setMenu(false) }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [menu])

  return (
    <div className="group flex items-start gap-3 px-4 py-3 transition hover:bg-surface/60">
      <input type="checkbox" checked={false} onChange={onToggle} aria-label={`Mark ${task.title} done`} disabled={saving} title={saving ? 'Saving…' : undefined}
        className="mt-0.5 size-[18px] shrink-0 cursor-pointer rounded-full accent-[var(--accent-solid)] disabled:opacity-50" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-1.5">
          <button type="button" onClick={onEdit} disabled={saving} aria-label={`Edit ${task.title}`} className="min-w-0 text-left leading-snug hover:text-accent disabled:hover:text-fg">{task.title}</button>
          {task.priority === 'high' && <span className="mt-0.5 inline-flex shrink-0 items-center text-danger"><Flag size={13} className="fill-current" aria-hidden /><span className="sr-only">High priority</span></span>}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
          <CourseTag course={course} />
          {type && <span className="inline-flex items-center gap-1"><type.icon size={12} aria-hidden />{type.label}</span>}
          {task.due_at && (
            <span className="inline-flex items-center gap-1">
              {overdue && <span className="font-medium text-danger">Overdue</span>}
              <span>{formatDue(task.due_at, tz, now)}</span>
            </span>
          )}
        </div>
      </div>
      <div ref={box} className="relative flex shrink-0 items-center gap-0.5 opacity-100 transition lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
        <button type="button" aria-label={`Move ${task.title}`} aria-haspopup="menu" aria-expanded={menu} disabled={saving} onClick={() => setMenu(m => !m)} className={BTN_ICON}><CalendarClock size={16} aria-hidden /></button>
        {onDelete && <button type="button" aria-label={`Delete ${task.title}`} disabled={saving} onClick={onDelete} className={`${BTN_ICON} hover:text-danger`}><Trash2 size={16} aria-hidden /></button>}
        {menu && (
          <div role="menu" aria-label={`Move ${task.title}`} className="menu-panel right-0 top-full min-w-36" onKeyDown={e => { if (e.key === 'Escape') setMenu(false) }}>
            {MOVES.map(m => <button key={m.id} type="button" role="menuitem" className="menu-item" onClick={() => { setMenu(false); onMove(m.id) }}>{m.label}</button>)}
          </div>
        )}
      </div>
    </div>
  )
}
