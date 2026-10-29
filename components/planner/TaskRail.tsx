'use client'
import { BellRing, Calendar, CalendarCheck, CheckCircle2, Inbox, ListTodo, type LucideIcon } from 'lucide-react'
import { LISTS, type ListId } from '@/lib/tasks/lists'
import type { TaskType } from '@/lib/types'

export type TypeFilter = 'all' | TaskType
const ICON: Record<ListId, LucideIcon> = { all: ListTodo, today: CalendarCheck, upcoming: Calendar, someday: Inbox, done: CheckCircle2 }
const TYPES: { id: TypeFilter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'other', label: 'Tasks' }, { id: 'assignment', label: 'Assignments' }, { id: 'exam', label: 'Exams' }, { id: 'reading', label: 'Readings' },
]

// The left side of the Tasks tab: which list to look at, and which type of task. A strip across the top on a phone.
export function TaskRail({ list, onList, counts, type, onType, typeCounts, reminders }: {
  list: ListId | null; onList: (l: ListId) => void; counts: Record<ListId, number>
  type: TypeFilter; onType: (t: TypeFilter) => void; typeCounts: Record<TypeFilter, number>
  /** The student's own reminders, as one more list: how many are coming, whether it is open, and opening it */
  reminders?: { count: number; on: boolean; onOpen: () => void }
}) {
  return (
    <div className="min-w-0 space-y-2 lg:sticky lg:top-4 lg:space-y-4 lg:self-start">
      <nav aria-label="Task lists" className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
        {LISTS.map(l => {
          const Icon = ICON[l.id]
          const on = list === l.id
          return (
            <button key={l.id} type="button" aria-current={on ? 'true' : undefined} onClick={() => onList(l.id)}
              className={`choice flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition max-md:px-4 ${on ? 'bg-accent-soft font-medium text-accent' : 'text-fg hover:bg-surface'}`}>
              <Icon size={16} aria-hidden /><span className="flex-1 text-left">{l.label}</span>{' '}<span className={`text-xs ${on ? 'text-accent' : 'text-muted'}`}>{counts[l.id]}</span>
            </button>
          )
        })}
        {reminders && (
          <button type="button" aria-current={reminders.on ? 'true' : undefined} onClick={reminders.onOpen}
            className={`choice flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition max-md:px-4 lg:mt-2 lg:border-t lg:border-line lg:pt-3 ${reminders.on ? 'bg-accent-soft font-medium text-accent' : 'text-fg hover:bg-surface'}`}>
            <BellRing size={16} aria-hidden /><span className="flex-1 text-left">Reminders</span>{' '}<span className={`text-xs ${reminders.on ? 'text-accent' : 'text-muted'}`}>{reminders.count}</span>
          </button>
        )}
      </nav>
      {/* the type of task is for the task lists, not for reminders */}
      {!reminders?.on && <div>
        <p className="section-label !mb-1.5 hidden px-3 !text-sm lg:block">Type</p>
        <div role="group" aria-label="Task type" className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0">
          {TYPES.map(t => {
            const on = type === t.id
            return (
              <button key={t.id} type="button" aria-pressed={on} onClick={() => onType(t.id)}
                className={`flex shrink-0 items-center justify-between gap-2 whitespace-nowrap choice rounded-xl px-3 py-2 text-sm pointer-coarse:py-2.5 transition max-md:px-4 ${on ? 'bg-surface font-medium' : 'text-muted hover:bg-surface hover:text-fg'}`}>
                <span>{t.label}</span>{' '}<span className="text-xs">{typeCounts[t.id]}</span>
              </button>
            )
          })}
        </div>
      </div>}
    </div>
  )
}
