'use client'
import { ChevronLeft, ChevronRight, GraduationCap, ListTodo, School } from 'lucide-react'
import { CAL_BTN, CAL_BTN_SOFT } from './buttons'
import type { CalView } from '@/lib/calendar/range'

export type AddKind = 'class' | 'exam' | 'task'
const VIEWS: { id: CalView; label: string }[] = [{ id: 'day', label: 'Day' }, { id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }]
const ADD: { kind: AddKind; label: string; icon: typeof School }[] = [
  { kind: 'task', label: 'Add task', icon: ListTodo }, { kind: 'exam', label: 'Add exam', icon: GraduationCap }, { kind: 'class', label: 'Add class', icon: School },
]

// One bar: Today and back/forward on the left, the range, the Day / Week / Month switch, and tinted Add buttons on the right
export function CalendarToolbar({ title, view, onView, onToday, onPrev, onNext, onAdd }: {
  title: string; view: CalView; onView: (v: CalView) => void; onToday: () => void; onPrev: () => void; onNext: () => void; onAdd: (k: AddKind) => void
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
      <div className="flex items-center gap-2">
        <button type="button" className={CAL_BTN} onClick={onToday}>Today</button>
        <div className="flex overflow-hidden rounded-lg border border-line bg-raised">
          <button type="button" className="px-2 py-1.5 hover:bg-surface" aria-label="Previous" onClick={onPrev}><ChevronLeft size={16} aria-hidden /></button>
          <span aria-hidden className="w-px bg-line" />
          <button type="button" className="px-2 py-1.5 hover:bg-surface" aria-label="Next" onClick={onNext}><ChevronRight size={16} aria-hidden /></button>
        </div>
      </div>
      <h2 className="mr-auto text-base font-semibold" aria-live="polite">{title}</h2>
      <div role="group" aria-label="View" className="flex rounded-lg bg-surface p-0.5">
        {VIEWS.map(v => (
          <button key={v.id} type="button" aria-pressed={view === v.id} onClick={() => onView(v.id)}
            className={`rounded-md px-3 py-1 text-sm transition ${view === v.id ? 'bg-raised font-medium shadow-sm' : 'text-muted hover:text-fg'}`}>{v.label}</button>
        ))}
      </div>
      <div className="flex gap-1.5">
        {ADD.map(a => <button key={a.kind} type="button" className={CAL_BTN_SOFT} onClick={() => onAdd(a.kind)}><a.icon size={14} aria-hidden />{a.label}</button>)}
      </div>
    </div>
  )
}
