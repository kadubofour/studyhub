'use client'
import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, GraduationCap, ListTodo, Plus, School } from 'lucide-react'
import type { CalView } from '@/lib/calendar/range'

export type AddKind = 'class' | 'exam' | 'task'
const VIEWS: { id: CalView; label: string }[] = [{ id: 'day', label: 'Day' }, { id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }]
const ADD: { kind: AddKind; label: string; icon: typeof School }[] = [
  { kind: 'class', label: 'Class', icon: School },
  { kind: 'exam', label: 'Exam date', icon: GraduationCap },
  { kind: 'task', label: 'Task', icon: ListTodo },
]

// Today, back and forward, the range, Day / Week / Month, and the Add menu
export function CalendarToolbar({ title, view, onView, onToday, onPrev, onNext, onAdd }: {
  title: string; view: CalView; onView: (v: CalView) => void; onToday: () => void; onPrev: () => void; onNext: () => void; onAdd: (k: AddKind) => void
}) {
  const [menu, setMenu] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menu) return
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setMenu(false) }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [menu])

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <button type="button" className="btn" onClick={onToday}>Today</button>
      <div className="flex items-center">
        <button type="button" className="btn-ghost px-1.5" aria-label="Previous" onClick={onPrev}><ChevronLeft size={18} aria-hidden /></button>
        <button type="button" className="btn-ghost px-1.5" aria-label="Next" onClick={onNext}><ChevronRight size={18} aria-hidden /></button>
      </div>
      <h2 className="mr-auto text-lg font-medium" aria-live="polite">{title}</h2>
      <div role="group" aria-label="View" className="flex rounded-full border border-line bg-surface p-0.5 text-sm">
        {VIEWS.map(v => (
          <button key={v.id} type="button" aria-pressed={view === v.id} onClick={() => onView(v.id)}
            className={`rounded-full px-3 py-1 transition ${view === v.id ? 'bg-raised font-medium shadow-sm' : 'text-muted hover:text-fg'}`}>{v.label}</button>
        ))}
      </div>
      <div ref={box} className="relative">
        <button type="button" className="btn-primary" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(m => !m)}><Plus size={15} aria-hidden />Add</button>
        {menu && (
          <div role="menu" aria-label="Add" className="menu-panel right-0 min-w-44" onKeyDown={e => { if (e.key === 'Escape') setMenu(false) }}>
            {ADD.map(a => (
              <button key={a.kind} type="button" role="menuitem" className="menu-item" onClick={() => { setMenu(false); onAdd(a.kind) }}>
                <span className="menu-icon"><a.icon size={15} aria-hidden /></span>{a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
