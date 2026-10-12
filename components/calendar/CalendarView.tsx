'use client'
import { useEffect, useMemo, useState } from 'react'
import { GraduationCap } from 'lucide-react'
import { CalendarToolbar, type AddKind } from './CalendarToolbar'
import { MiniMonth } from './MiniMonth'
import { MonthGrid } from './MonthGrid'
import { TimeGrid } from './TimeGrid'
import { ClassDialog } from '@/components/planner/ClassDialog'
import { TaskDialog } from '@/components/planner/TaskDialog'
import { KIND_LABEL } from '@/components/plan/SessionRow'
import { usePlans } from '@/components/plan/usePlans'
import { dayItems, type DayItem } from '@/lib/calendar/events'
import { rangeTitle, shiftAnchor, visibleKeys, type CalView } from '@/lib/calendar/range'
import { endOfLocalDay, localDayKey, weekdayOfKey, type DayKey } from '@/lib/dates'
import type { NewTask } from '@/lib/data/tasks'
import type { ClassSlot, Course, Task } from '@/lib/types'

type Props = {
  classes: ClassSlot[]; courses: Course[]; tasks: Task[]; tz: string
  /** Nothing at all yet (no classes, no tasks): show the invitation */
  empty: boolean
  /** The course being looked at: study sessions of other courses are left out */
  courseId?: string | null
  onSaveClass: (input: Omit<ClassSlot, 'id'>, id?: string) => void
  onDeleteClass: (id: string) => void
  onAddTask: (input: NewTask) => void
  onEditTask: (id: string, patch: NewTask) => void
  onDoneTask: (task: Task) => void
  onDeleteTask: (task: Task) => void
}

// The planner's calendar: Day, Week or Month with a mini month, an Add menu, classes, deadlines and study sessions
export function CalendarView({ classes, courses, tasks, tz, empty, courseId = null, onSaveClass, onDeleteClass, onAddTask, onEditTask, onDoneTask, onDeleteTask }: Props) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])
  const todayKey = localDayKey(now, tz)
  const [view, setView] = useState<CalView>('week')
  const [anchor, setAnchor] = useState<DayKey>(todayKey)
  const [classDialog, setClassDialog] = useState<Partial<ClassSlot> | null>(null)
  const [taskDialog, setTaskDialog] = useState<Partial<Task> | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const keys = visibleKeys(view, anchor)
  const plans = usePlans()
  const sessionsByDay = useMemo(() => {
    const out: Record<DayKey, { id: string; title: string; courseId: string | null }[]> = {}
    for (const v of plans.views ?? []) {
      if (courseId && v.courseId !== courseId) continue
      const add = (day: DayKey, s: { id: string; kind: keyof typeof KIND_LABEL; topicName: string }) =>
        (out[day] ??= []).push({ id: `${v.plan.id}-${day}-${s.id}`, title: `${KIND_LABEL[s.kind]}: ${s.topicName}`, courseId: v.courseId })
      for (const s of v.today) if (!s.done_at) add(todayKey, s)
      for (const d of v.schedule) for (const s of d.sessions) add(d.day, { id: `${s.topicId}-${s.kind}`, kind: s.kind, topicName: s.topicName })
    }
    return out
  }, [plans.views, todayKey, courseId])
  const itemsByDay = useMemo(() => {
    const out: Record<DayKey, DayItem[]> = {}
    for (const k of keys) out[k] = dayItems(k, tasks, sessionsByDay[k] ?? [], tz)
    return out
    // keys is rebuilt each render from view and anchor
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, anchor, tasks, sessionsByDay, tz])

  const dueOn = (k: DayKey) => endOfLocalDay(k, tz).toISOString()
  function add(kind: AddKind) {
    setNotice(null)
    if (kind === 'class') {
      if (courses.length === 0) { setNotice('Add a course first, then add its classes.'); return }
      setClassDialog({ day_of_week: weekdayOfKey(anchor) })
    } else setTaskDialog({ type: kind === 'exam' ? 'exam' : 'other', due_at: dueOn(anchor) })
  }
  // Something still being saved has no real id yet, so it cannot be opened
  function openItem(i: DayItem) {
    const t = tasks.find(x => x.id === i.id)
    if (t && !t.id.startsWith('temp-')) setTaskDialog(t)
  }
  const openClass = (c: ClassSlot) => { if (!c.id.startsWith('temp-')) setClassDialog(c) }
  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <div>
      <CalendarToolbar title={rangeTitle(view, anchor)} view={view} onView={setView} onToday={() => setAnchor(todayKey)}
        onPrev={() => setAnchor(a => shiftAnchor(view, a, -1))} onNext={() => setAnchor(a => shiftAnchor(view, a, 1))} onAdd={add} />
      <p role="status" className="mb-2 min-h-0 text-sm text-muted empty:hidden">{notice}</p>
      <div className="flex items-start gap-4">
        <aside aria-label="Month" className="hidden shrink-0 lg:block"><MiniMonth anchor={anchor} todayKey={todayKey} rangeKeys={keys} onPick={k => setAnchor(k)} /></aside>
        <div className="relative min-w-0 flex-1">
          {view === 'month'
            ? <MonthGrid keys={keys} anchor={anchor} todayKey={todayKey} classes={classes} courses={courses} itemsByDay={itemsByDay}
                onDayClick={k => { setAnchor(k); setView('day') }} onItemClick={openItem} onClassClick={openClass} />
            : <TimeGrid keys={keys} todayKey={todayKey} now={now} tz={tz} classes={classes} courses={courses} itemsByDay={itemsByDay}
                onClassClick={openClass} onItemClick={openItem}
                onSlotClick={(k, h) => {
                  if (courses.length === 0) { setNotice('Add a course first, then add its classes.'); return }
                  setNotice(null)
                  setClassDialog({ day_of_week: weekdayOfKey(k), start_time: `${pad(h)}:00`, end_time: h >= 23 ? '23:59' : `${pad(h + 1)}:00` })
                }} />}
          {empty && (
            <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center p-4">
              <div className="pointer-events-auto flex max-w-xs flex-col items-center gap-2 rounded-2xl border border-line bg-raised/95 p-6 text-center shadow-lg backdrop-blur">
                <GraduationCap size={26} className="text-accent" aria-hidden />
                <h3 className="text-base font-semibold">Add your first exam</h3>
                <p className="text-sm text-muted">Tell us when your exam is and what it covers. We will plan study time for it.</p>
                <button type="button" className="btn-primary mt-1" onClick={() => add('exam')}>Add an exam</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ClassDialog open={classDialog !== null} initial={classDialog} courses={courses} onClose={() => setClassDialog(null)}
        onSave={input => { const id = classDialog?.id; setClassDialog(null); onSaveClass(input, id) }}
        onDelete={classDialog?.id ? () => { const id = classDialog.id!; setClassDialog(null); onDeleteClass(id) } : undefined} />
      <TaskDialog open={taskDialog !== null} initial={taskDialog} courses={courses} tz={tz} onClose={() => setTaskDialog(null)}
        onSave={input => { const id = taskDialog?.id; setTaskDialog(null); if (id) onEditTask(id, input); else onAddTask(input) }}
        onDone={taskDialog?.id ? () => { const t = tasks.find(x => x.id === taskDialog.id); setTaskDialog(null); if (t) onDoneTask(t) } : undefined}
        onDelete={taskDialog?.id ? () => { const t = tasks.find(x => x.id === taskDialog.id); setTaskDialog(null); if (t) onDeleteTask(t) } : undefined} />
    </div>
  )
}
