'use client'
import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, ListTodo, X } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { listOpenTasks } from '@/lib/data/tasks'
import { listCourses } from '@/lib/data/courses'
import { useProfile } from '@/components/providers/ProfileProvider'
import { setFocusTask, useFocusTask } from '@/lib/focus/task'
import { formatDueLong } from '@/lib/dates'
import type { Course, Task } from '@/lib/types'

const SHOWN = 8

// "What are you working on?": one of the open tasks, soonest due first, or nothing in particular. It is remembered while the student moves around
// the app, shown under the clock, and saved with the session.
export function FocusTaskPicker() {
  const { profile } = useProfile()
  const task = useFocusTask(profile.id)
  const [open, setOpen] = useState(false)
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    let live = true
    listOpenTasks(supabase()).then(t => { if (live) setTasks(t) }).catch(() => { if (live) setTasks([]) })
    listCourses(supabase()).then(c => { if (live) setCourses(c) }).catch(() => {})
    const away = (e: Event) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => { live = false; document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc) }
  }, [open])

  const courseOf = (id: string | null) => courses.find(c => c.id === id)
  const choose = (t: Task | null) => {
    setFocusTask(t ? { uid: profile.id, id: t.id, title: t.title, course_id: t.course_id } : null)
    setOpen(false)
  }
  const shown = (tasks ?? []).filter(t => !t.id.startsWith('temp-')).slice(0, SHOWN)

  return (
    <div ref={box} className="relative mx-auto flex w-full max-w-full items-center justify-center px-4">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(o => !o)}
        className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-xl border border-line bg-raised px-3.5 py-2 text-sm transition hover:bg-surface pointer-coarse:py-2.5">
        <ListTodo size={15} className="shrink-0 text-accent" aria-hidden />
        {task
          ? <><span className="shrink-0 whitespace-nowrap text-muted">Working on</span><span className="truncate font-medium">{task.title}</span></>
          : <span className="text-muted">What are you working on?</span>}
        <ChevronDown size={14} className="shrink-0 text-muted" aria-hidden />
      </button>
      {task && (
        <button type="button" aria-label="Clear the task" title="Work on nothing in particular" onClick={() => choose(null)}
          className="ml-1 inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-surface hover:text-fg"><X size={15} aria-hidden /></button>
      )}
      {open && (
        <div role="listbox" aria-label="Open tasks" className="absolute left-1/2 top-full z-30 mt-2 w-[min(92vw,24rem)] -translate-x-1/2 overflow-hidden rounded-2xl border border-line bg-raised text-left shadow-xl">
          <div className="max-h-72 overflow-y-auto p-1.5">
            <button type="button" role="option" aria-selected={!task} onClick={() => choose(null)}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-surface">
              <span className="flex-1">Nothing in particular</span>{!task && <Check size={15} className="text-accent" aria-hidden />}
            </button>
            {tasks === null && <p className="px-3 py-3 text-sm text-muted" role="status">Loading your tasks…</p>}
            {tasks !== null && shown.length === 0 && <p className="px-3 py-3 text-sm text-muted">No open tasks. Add one in the Planner.</p>}
            {shown.map(t => {
              const c = courseOf(t.course_id)
              const on = task?.id === t.id
              return (
                <button key={t.id} type="button" role="option" aria-selected={on} onClick={() => choose(t)}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-surface">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{t.title}</span>
                    <span className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                      {c && <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2 rounded-[3px]" style={{ background: c.color }} />{c.name}</span>}
                      {t.due_at && <span>Due {formatDueLong(t.due_at, profile.timezone)}</span>}
                    </span>
                  </span>
                  {on && <Check size={15} className="shrink-0 text-accent" aria-hidden />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
