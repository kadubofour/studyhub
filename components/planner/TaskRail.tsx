'use client'
import { Calendar, CalendarCheck, CheckCircle2, Inbox, ListTodo, type LucideIcon } from 'lucide-react'
import { LISTS, type ListId } from '@/lib/tasks/lists'
import type { TaskType } from '@/lib/types'

export type TypeFilter = 'all' | TaskType
const ICON: Record<ListId, LucideIcon> = { all: ListTodo, today: CalendarCheck, upcoming: Calendar, someday: Inbox, done: CheckCircle2 }
const TYPES: { id: TypeFilter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'other', label: 'Tasks' }, { id: 'assignment', label: 'Assignments' }, { id: 'exam', label: 'Exams' }, { id: 'reading', label: 'Readings' },
]

// The left side of the Tasks tab: which list to look at, and which type of task. A strip across the top on a phone.
export function TaskRail({ list, onList, counts, type, onType, typeCounts }: {
  list: ListId; onList: (l: ListId) => void; counts: Record<ListId, number>
  type: TypeFilter; onType: (t: TypeFilter) => void; typeCounts: Record<TypeFilter, number>
}) {
  return (
    <div className="min-w-0 space-y-4 lg:sticky lg:top-4 lg:self-start">
      <nav aria-label="Task lists" className="no-scrollbar flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {LISTS.map(l => {
          const Icon = ICON[l.id]
          const on = list === l.id
          return (
            <button key={l.id} type="button" aria-current={on ? 'true' : undefined} onClick={() => onList(l.id)}
              className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition ${on ? 'bg-accent-soft font-medium text-accent' : 'text-fg hover:bg-surface'}`}>
              <Icon size={16} aria-hidden /><span className="flex-1 text-left">{l.label}</span>{' '}<span className={`text-xs ${on ? 'text-accent' : 'text-muted'}`}>{counts[l.id]}</span>
            </button>
          )
        })}
      </nav>
      <div>
        <p className="mb-1.5 hidden px-3 text-xs font-medium text-muted lg:block">Type</p>
        <div role="group" aria-label="Task type" className="flex flex-wrap gap-1.5 lg:flex-col lg:gap-0.5">
          {TYPES.map(t => {
            const on = type === t.id
            return (
              <button key={t.id} type="button" aria-pressed={on} onClick={() => onType(t.id)}
                className={`flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-sm transition ${on ? 'bg-surface font-medium' : 'text-muted hover:bg-surface hover:text-fg'}`}>
                <span>{t.label}</span>{' '}<span className="text-xs">{typeCounts[t.id]}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
