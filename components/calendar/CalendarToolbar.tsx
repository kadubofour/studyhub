'use client'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { CalView } from '@/lib/calendar/range'

export type AddKind = 'class' | 'exam' | 'task'
const VIEWS: { id: CalView; label: string }[] = [{ id: 'day', label: 'Day' }, { id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }]
const ADD: { kind: AddKind; label: string }[] = [{ kind: 'task', label: 'Add task' }, { kind: 'exam', label: 'Add exam' }, { kind: 'class', label: 'Add class' }]

// Today, back and forward, the range, Day / Week / Month, and plain buttons to add a task, an exam or a class
export function CalendarToolbar({ title, view, onView, onToday, onPrev, onNext, onAdd }: {
  title: string; view: CalView; onView: (v: CalView) => void; onToday: () => void; onPrev: () => void; onNext: () => void; onAdd: (k: AddKind) => void
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <button type="button" className="btn" onClick={onToday}>Today</button>
      <div className="flex items-center">
        <button type="button" className="btn-ghost px-1.5" aria-label="Previous" onClick={onPrev}><ChevronLeft size={18} aria-hidden /></button>
        <button type="button" className="btn-ghost px-1.5" aria-label="Next" onClick={onNext}><ChevronRight size={18} aria-hidden /></button>
      </div>
      <h2 className="mr-auto text-base font-medium" aria-live="polite">{title}</h2>
      <div role="group" aria-label="View" className="flex gap-1">
        {VIEWS.map(v => (
          <button key={v.id} type="button" aria-pressed={view === v.id} onClick={() => onView(v.id)}
            className={`rounded-lg px-3 py-1 text-sm ${view === v.id ? 'bg-surface font-medium' : 'text-muted hover:text-fg'}`}>{v.label}</button>
        ))}
      </div>
      <div className="flex gap-1.5">
        {ADD.map(a => <button key={a.kind} type="button" className="btn" onClick={() => onAdd(a.kind)}>{a.label}</button>)}
      </div>
    </div>
  )
}
