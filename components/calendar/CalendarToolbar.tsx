'use client'
import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, GraduationCap, ListTodo, Plus, School, X } from 'lucide-react'
import { CAL_BTN, CAL_BTN_SOFT } from './buttons'
import type { CalView } from '@/lib/calendar/range'

export type AddKind = 'class' | 'exam' | 'task'
const VIEWS: { id: CalView; label: string }[] = [{ id: 'day', label: 'Day' }, { id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }]
const ADD: { kind: AddKind; label: string; icon: typeof School }[] = [
  { kind: 'task', label: 'Add task', icon: ListTodo }, { kind: 'exam', label: 'Add exam', icon: GraduationCap }, { kind: 'class', label: 'Add class', icon: School },
]

// On a phone the three Add buttons would take a row of their own, so they live behind one round button that floats above the bottom bar
function AddFab({ onAdd }: { onAdd: (k: AddKind) => void }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: Event) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc) }
  }, [open])
  return (
    <div ref={box} className="fixed bottom-[calc(7.25rem+env(safe-area-inset-bottom))] right-4 z-40 flex flex-col items-end gap-2 md:hidden">
      {open && (
        <div role="menu" aria-label="Add to the calendar" className="flex flex-col items-end gap-2">
          {ADD.map(a => (
            <button key={a.kind} type="button" role="menuitem" onClick={() => { setOpen(false); onAdd(a.kind) }}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-raised px-4 text-sm font-medium shadow-lg"><a.icon size={16} aria-hidden />{a.label}</button>
          ))}
        </div>
      )}
      <button type="button" aria-label="Add to calendar" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}
        className="grid size-14 place-items-center rounded-full bg-accent-solid text-white shadow-xl transition active:scale-95">
        {open ? <X size={24} aria-hidden /> : <Plus size={26} aria-hidden />}
      </button>
    </div>
  )
}

// Today and back/forward with the range on one line; the Day / Week / Month switch below it, full width on a phone; tinted Add buttons on the right
// (a round add button on a phone)
export function CalendarToolbar({ title, view, onView, onToday, onPrev, onNext, onAdd }: {
  title: string; view: CalView; onView: (v: CalView) => void; onToday: () => void; onPrev: () => void; onNext: () => void; onAdd: (k: AddKind) => void
}) {
  return (
    <div className="mb-3 space-y-2.5 md:flex md:flex-wrap md:items-center md:gap-x-3 md:gap-y-2 md:space-y-0">
      <div className="flex items-center gap-2 md:contents">
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" className={CAL_BTN} onClick={onToday}>Today</button>
          <div className="flex overflow-hidden rounded-lg border border-line bg-raised">
            <button type="button" className="px-2 py-1.5 hover:bg-surface pointer-coarse:px-3 pointer-coarse:py-2.5" aria-label="Previous" onClick={onPrev}><ChevronLeft size={16} aria-hidden /></button>
            <span aria-hidden className="w-px bg-line" />
            <button type="button" className="px-2 py-1.5 hover:bg-surface pointer-coarse:px-3 pointer-coarse:py-2.5" aria-label="Next" onClick={onNext}><ChevronRight size={16} aria-hidden /></button>
          </div>
        </div>
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold md:mr-auto md:flex-none" aria-live="polite">{title}</h2>
      </div>
      <div role="group" aria-label="View" className="grid grid-cols-3 rounded-xl bg-surface p-0.5 md:flex md:rounded-lg">
        {VIEWS.map(v => (
          <button key={v.id} type="button" aria-pressed={view === v.id} onClick={() => onView(v.id)}
            className={`rounded-[10px] px-3 py-1.5 text-center text-sm pointer-coarse:py-2 md:rounded-md md:py-1 transition ${view === v.id ? 'bg-raised font-medium shadow-sm' : 'text-muted hover:text-fg'}`}>{v.label}</button>
        ))}
      </div>
      <div className="hidden gap-1.5 md:flex">
        {ADD.map(a => <button key={a.kind} type="button" className={CAL_BTN_SOFT} onClick={() => onAdd(a.kind)}><a.icon size={14} aria-hidden />{a.label}</button>)}
      </div>
      <AddFab onAdd={onAdd} />
    </div>
  )
}
