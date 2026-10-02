'use client'
import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { CourseBar } from '@/components/planner/CourseBar'
import { QuickAdd } from '@/components/planner/QuickAdd'
import { TaskRow } from '@/components/planner/TaskRow'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useSaver } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { listCourses } from '@/lib/data/courses'
import { createTask, deleteTask, listOpenTasks, setTaskDone, type NewTask } from '@/lib/data/tasks'
import { WeekGrid } from '@/components/planner/WeekGrid'
import { ClassDialog } from '@/components/planner/ClassDialog'
import { createClass, deleteClass, listClasses, updateClass } from '@/lib/data/classes'
import { bucketTasks, localDayKey, weekKeysFor } from '@/lib/dates'
import type { ClassSlot, Course, Task } from '@/lib/types'

type Tab = 'tasks' | 'week' | 'timetable'

export default function PlannerPage() {
  const { profile } = useProfile()
  const save = useSaver()
  const tz = profile.timezone
  const [tab, setTab] = useState<Tab>('tasks')
  const [courses, setCourses] = useState<Course[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [filter, setFilter] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [classes, setClasses] = useState<ClassSlot[]>([])
  const [dialog, setDialog] = useState<Partial<ClassSlot> | null>(null)

  useEffect(() => {
    const sb = supabase()
    Promise.all([listCourses(sb), listOpenTasks(sb), listClasses(sb)])
      .then(([c, t, cl]) => { setCourses(c); setTasks(t); setClasses(cl); setLoaded(true) })
  }, [])

  const now = new Date()
  const visible = useMemo(() => tasks.filter(t => !filter || t.course_id === filter), [tasks, filter])
  const buckets = bucketTasks(visible, tz, now)
  const courseOf = (id: string | null) => courses.find(c => c.id === id)

  const todayKey = localDayKey(now, tz)
  const weekKeys = weekKeysFor(todayKey)
  const visibleClasses = classes.filter(c => !filter || c.course_id === filter)
  const deadlines = visible
    .filter(t => t.due_at && weekKeys.includes(localDayKey(t.due_at, tz)))
    .map(t => ({ id: t.id, title: t.title, dayKey: localDayKey(t.due_at!, tz), color: courseOf(t.course_id)?.color }))

  function saveClass(input: Omit<ClassSlot, 'id'>) {
    const editing = dialog?.id
    setDialog(null)
    if (editing) {
      const before = classes.find(c => c.id === editing)!
      save(
        () => setClasses(cs => cs.map(c => (c.id === editing ? { ...c, ...input } : c))),
        () => setClasses(cs => cs.map(c => (c.id === editing ? before : c))),
        () => updateClass(supabase(), editing, input),
      )
    } else {
      const temp = { ...input, id: `temp-${crypto.randomUUID()}` }
      save(
        () => setClasses(cs => [...cs, temp]),
        () => setClasses(cs => cs.filter(c => c.id !== temp.id)),
        async () => { const real = await createClass(supabase(), input); setClasses(cs => cs.map(c => (c.id === temp.id ? real : c))) },
      )
    }
  }

  function removeClass(id: string) {
    const before = classes.find(c => c.id === id)!
    setDialog(null)
    save(
      () => setClasses(cs => cs.filter(c => c.id !== id)),
      () => setClasses(cs => [...cs, before]),
      () => deleteClass(supabase(), id),
    )
  }

  function add(input: NewTask) {
    const temp: Task = {
      id: `temp-${crypto.randomUUID()}`, course_id: input.course_id ?? null, title: input.title, type: input.type ?? 'other',
      due_at: input.due_at ?? null, priority: 'normal', done_at: null, created_at: new Date().toISOString(),
    }
    save(
      () => setTasks(ts => [...ts, temp]),
      () => setTasks(ts => ts.filter(t => t.id !== temp.id)),
      async () => { const real = await createTask(supabase(), input); setTasks(ts => ts.map(t => (t.id === temp.id ? real : t))) },
    )
  }

  function toggle(task: Task) {
    save(
      () => setTasks(ts => ts.filter(t => t.id !== task.id)),
      () => setTasks(ts => [...ts, task]),
      () => setTaskDone(supabase(), task.id, true),
    )
  }

  function remove(task: Task) {
    save(
      () => setTasks(ts => ts.filter(t => t.id !== task.id)),
      () => setTasks(ts => [...ts, task]),
      () => deleteTask(supabase(), task.id),
    )
  }

  const group = (label: string, list: Task[], color = 'text-muted') => list.length > 0 && (
    <section className="mt-4">
      <h2 className={`mb-1 text-xs font-medium ${color}`}>{label}</h2>
      {list.map(t => (
        <TaskRow key={t.id} task={t} course={courseOf(t.course_id)} tz={tz} now={now} onToggle={() => toggle(t)} onDelete={() => remove(t)} />
      ))}
    </section>
  )

  return (
    <div>
      <PageHeader title="Planner" />
      <CourseBar courses={courses} selected={filter} onSelect={setFilter} onChange={next => {
        setCourses(next)
        listOpenTasks(supabase()).then(setTasks) // course deletion may have changed tasks
        listClasses(supabase()).then(setClasses)
      }} />
      <div role="tablist" className="mb-2 flex gap-1">
        {(['tasks', 'week', 'timetable'] as Tab[]).map(t => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1 text-sm ${tab === t ? 'bg-surface font-medium' : 'text-muted'}`}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'tasks' && (
        <div>
          <QuickAdd courses={courses} defaultCourseId={filter} tz={tz} onAdd={add} />
          {loaded && courses.length === 0 && tasks.length === 0 && (
            <p className="mt-6 text-sm text-muted">Add your first course with “+ Course”, then add tasks above.</p>
          )}
          {group('Overdue', buckets.overdue, 'text-danger')}
          {group('Today', buckets.today, 'text-fg')}
          {group('Upcoming', buckets.upcoming)}
          {group('No date', buckets.noDate)}
        </div>
      )}
      {tab === 'week' && (
        <WeekGrid weekKeys={weekKeys} todayKey={todayKey} classes={visibleClasses} courses={courses} deadlines={deadlines} />
      )}
      {tab === 'timetable' && (
        <div>
          {courses.length === 0
            ? <p className="text-sm text-muted">Add a course first, then add its classes here.</p>
            : <button className="btn mb-3" onClick={() => setDialog({})}>Add class</button>}
          <WeekGrid weekKeys={weekKeys} todayKey={todayKey} classes={visibleClasses} courses={courses} deadlines={[]}
            onClassClick={c => setDialog(c)}
            onEmptyClick={(dow, h) => { if (courses.length) setDialog({ day_of_week: dow, start_time: `${String(h).padStart(2, '0')}:00`, end_time: `${String(h + 1).padStart(2, '0')}:00` }) }} />
          <ClassDialog open={dialog !== null} initial={dialog} courses={courses} onClose={() => setDialog(null)}
            onSave={saveClass} onDelete={dialog?.id ? () => removeClass(dialog.id!) : undefined} />
        </div>
      )}
    </div>
  )
}
