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
import { bucketTasks } from '@/lib/dates'
import type { Course, Task } from '@/lib/types'

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

  useEffect(() => {
    const sb = supabase()
    Promise.all([listCourses(sb), listOpenTasks(sb)]).then(([c, t]) => { setCourses(c); setTasks(t); setLoaded(true) })
  }, [])

  const now = new Date()
  const visible = useMemo(() => tasks.filter(t => !filter || t.course_id === filter), [tasks, filter])
  const buckets = bucketTasks(visible, tz, now)
  const courseOf = (id: string | null) => courses.find(c => c.id === id)

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
      {tab !== 'tasks' && <p className="text-sm text-muted">Coming in the next step.</p>}
    </div>
  )
}
