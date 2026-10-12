'use client'
import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { CourseBar } from '@/components/planner/CourseBar'
import { QuickAdd } from '@/components/planner/QuickAdd'
import { StudyPlanPanel } from '@/components/plan/StudyPlanPanel'
import { TaskRow } from '@/components/planner/TaskRow'
import { TaskDialog } from '@/components/planner/TaskDialog'
import { CalendarView } from '@/components/calendar/CalendarView'
import { TimetableView } from '@/components/calendar/TimetableView'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useSaver, useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { listCourses } from '@/lib/data/courses'
import { createTask, deleteTask, listOpenTasks, listRecentlyDone, setTaskDone, updateTask, type NewTask } from '@/lib/data/tasks'
import { createClass, deleteClass, listClasses, updateClass } from '@/lib/data/classes'
import { bucketTasks } from '@/lib/dates'
import type { ClassSlot, Course, Task, TaskType } from '@/lib/types'
import { useScanSaved } from '@/lib/scan/events'

type Tab = 'tasks' | 'week' | 'timetable'
type TypeFilter = 'all' | TaskType
const TYPE_CHIPS: { id: TypeFilter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'other', label: 'Tasks' }, { id: 'assignment', label: 'Assignments' }, { id: 'exam', label: 'Exams' }, { id: 'reading', label: 'Readings' },
]
const DONE_DAYS = 7

// Everything the planner shows; loaded at first and again after a scan adds items
const loadPlanner = () => {
  const sb = supabase()
  const since = new Date(Date.now() - DONE_DAYS * 86_400_000)
  return Promise.all([listCourses(sb), listOpenTasks(sb), listClasses(sb), listRecentlyDone(sb, since).catch(() => [] as Task[])])
}

export default function PlannerPage() {
  const { profile } = useProfile()
  const save = useSaver()
  const toast = useToast()
  const tz = profile.timezone
  const [tab, setTab] = useState<Tab>('tasks')
  const [courses, setCourses] = useState<Course[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [done, setDone] = useState<Task[]>([])
  const [showDone, setShowDone] = useState(false)
  const [filter, setFilter] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [loaded, setLoaded] = useState(false)
  const [classes, setClasses] = useState<ClassSlot[]>([])
  const [editing, setEditing] = useState<Task | null>(null)
  // Scan (in the app's sidebar) saved tasks or classes: show them
  useScanSaved(() => { loadPlanner().then(([c, t, cl, d]) => {
    setCourses(c); setClasses(cur => [...cl, ...cur.filter(x => x.id.startsWith('temp-'))]); setDone(d)
    setTasks(cur => [...t, ...cur.filter(x => x.id.startsWith('temp-'))])
  }).catch(() => {}) })

  useEffect(() => {
    loadPlanner().then(([c, t, cl, d]) => {
      setCourses(c); setClasses(cl); setLoaded(true)
      // Keep tasks added while this was loading: the list fetched before they existed lacks them
      setTasks(current => [...t, ...current.filter(x => !t.some(y => y.id === x.id))])
      setDone(current => [...current, ...d.filter(x => !current.some(y => y.id === x.id))])
    })
  }, [])

  const now = new Date()
  const byCourse = useMemo(() => tasks.filter(t => !filter || t.course_id === filter), [tasks, filter])
  const visible = useMemo(() => byCourse.filter(t => typeFilter === 'all' || t.type === typeFilter), [byCourse, typeFilter])
  const buckets = bucketTasks(visible, tz, now)
  const courseOf = (id: string | null) => courses.find(c => c.id === id)
  const countOf = (id: TypeFilter) => (id === 'all' ? byCourse.length : byCourse.filter(t => t.type === id).length)
  const visibleDone = done.filter(t => !filter || t.course_id === filter)
  const visibleClasses = classes.filter(c => !filter || c.course_id === filter)

  function saveClass(input: Omit<ClassSlot, 'id'>, editingId?: string) {
    if (editingId) {
      const before = classes.find(c => c.id === editingId)!
      save(
        () => setClasses(cs => cs.map(c => (c.id === editingId ? { ...c, ...input } : c))),
        () => setClasses(cs => cs.map(c => (c.id === editingId ? before : c))),
        () => updateClass(supabase(), editingId, input),
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
    save(
      () => setClasses(cs => cs.filter(c => c.id !== id)),
      () => setClasses(cs => [...cs, before]),
      () => deleteClass(supabase(), id),
    )
  }

  function add(input: NewTask) {
    const temp: Task = {
      id: `temp-${crypto.randomUUID()}`, course_id: input.course_id ?? null, title: input.title, type: input.type ?? 'other',
      due_at: input.due_at ?? null, priority: input.priority ?? 'normal', done_at: null, created_at: new Date().toISOString(),
    }
    save(
      () => setTasks(ts => [...ts, temp]),
      () => setTasks(ts => ts.filter(t => t.id !== temp.id)),
      async () => { const real = await createTask(supabase(), input); setTasks(ts => ts.map(t => (t.id === temp.id ? real : t))) },
    )
  }

  function edit(id: string, patch: NewTask) {
    const before = tasks.find(t => t.id === id)
    if (!before || id.startsWith('temp-')) return
    const change = { title: patch.title, type: patch.type ?? before.type, course_id: patch.course_id ?? null, due_at: patch.due_at ?? null, priority: patch.priority ?? before.priority }
    save(
      () => setTasks(ts => ts.map(t => (t.id === id ? { ...t, ...change } : t))),
      () => setTasks(ts => ts.map(t => (t.id === id ? before : t))),
      () => updateTask(supabase(), id, patch),
    )
  }

  // Ticking moves a task into Done at once; Undo (and unticking it there) puts it back
  function finish(task: Task) {
    const finished = { ...task, done_at: new Date().toISOString() }
    save(
      () => { setTasks(ts => ts.filter(t => t.id !== task.id)); setDone(ds => [finished, ...ds.filter(d => d.id !== task.id)]) },
      () => { setTasks(ts => (ts.some(t => t.id === task.id) ? ts : [...ts, task])); setDone(ds => ds.filter(d => d.id !== task.id)) },
      async () => {
        await setTaskDone(supabase(), task.id, true)
        toast('Marked done', { label: 'Undo', onClick: () => reopen(finished) })
      },
    )
  }

  function reopen(task: Task) {
    const reopened = { ...task, done_at: null }
    save(
      () => { setTasks(ts => (ts.some(t => t.id === task.id) ? ts : [...ts, reopened])); setDone(ds => ds.filter(d => d.id !== task.id)) },
      () => { setTasks(ts => ts.filter(t => t.id !== task.id)); setDone(ds => (ds.some(d => d.id === task.id) ? ds : [task, ...ds])) },
      () => setTaskDone(supabase(), task.id, false),
    )
  }

  function remove(task: Task) {
    save(
      () => { setTasks(ts => ts.filter(t => t.id !== task.id)); setDone(ds => ds.filter(d => d.id !== task.id)) },
      () => setTasks(ts => [...ts, task]),
      () => deleteTask(supabase(), task.id),
    )
  }

  const group = (label: string, list: Task[], color = 'text-muted') => list.length > 0 && (
    <section className="mt-4">
      <h2 className={`mb-1 text-xs font-medium ${color}`}>{label}</h2>
      {list.map(t => (
        <TaskRow key={t.id} task={t} course={courseOf(t.course_id)} tz={tz} now={now} onToggle={() => finish(t)} onDelete={() => remove(t)} onEdit={() => setEditing(t)} />
      ))}
    </section>
  )

  return (
    <div>
      <PageHeader title="Planner" />
      <CourseBar courses={courses} selected={filter} onSelect={setFilter} onChange={next => {
        setCourses(next)
        listOpenTasks(supabase()).then(setTasks) // course deletion may have changed tasks
        listRecentlyDone(supabase(), new Date(Date.now() - DONE_DAYS * 86_400_000)).then(setDone).catch(() => {})
        listClasses(supabase()).then(setClasses)
      }} />
      <div role="tablist" className="mb-3 flex gap-1">
        {(['tasks', 'week', 'timetable'] as Tab[]).map(t => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1 text-sm ${tab === t ? 'bg-surface font-medium' : 'text-muted'}`}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'tasks' && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0">
          <QuickAdd courses={courses} defaultCourseId={filter} tz={tz} onAdd={add} />
          <div role="group" aria-label="Task type" className="mb-1 flex flex-wrap gap-1.5">
            {TYPE_CHIPS.map(c => (
              <button key={c.id} type="button" aria-pressed={typeFilter === c.id} onClick={() => setTypeFilter(c.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition ${typeFilter === c.id ? 'border-transparent bg-accent-soft font-medium text-accent' : 'border-line bg-raised hover:bg-surface'}`}>
                {c.label} <span className="text-muted">{countOf(c.id)}</span>
              </button>
            ))}
          </div>
          {loaded && courses.length === 0 && tasks.length === 0 && (
            <p className="mt-6 text-sm text-muted">Add your first course with “+ Course”, then add tasks above.</p>
          )}
          {group('Overdue', buckets.overdue, 'text-danger')}
          {group('Today', buckets.today, 'text-fg')}
          {group('Upcoming', buckets.upcoming)}
          {group('No date', buckets.noDate)}
        </div>
        <aside aria-label="Study plan and finished tasks" className="min-w-0 space-y-4 empty:hidden [&>section]:!mt-0">
          <StudyPlanPanel courses={courses} tasks={tasks} />
        {visibleDone.length > 0 && (
          <section aria-label="Done" className="card">
            <button type="button" aria-expanded={showDone} onClick={() => setShowDone(s => !s)} className="flex items-center gap-1 text-xs font-medium text-muted hover:text-fg">
              {showDone ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}Done ({visibleDone.length})
            </button>
            {showDone && (
              <div className="mt-1">
                {visibleDone.map(t => <TaskRow key={t.id} task={t} course={courseOf(t.course_id)} tz={tz} now={now} done onToggle={() => reopen(t)} />)}
              </div>
            )}
          </section>
        )}
        </aside>
        </div>
      )}
      {tab === 'week' && (
        <CalendarView classes={visibleClasses} courses={courses} tasks={byCourse} tz={tz} courseId={filter}
          empty={loaded && classes.length === 0 && tasks.length === 0}
          onSaveClass={saveClass} onDeleteClass={removeClass} onAddTask={add} onEditTask={edit} onDoneTask={finish} onDeleteTask={remove} />
      )}
      {tab === 'timetable' && <TimetableView classes={visibleClasses} courses={courses} tz={tz} onSaveClass={saveClass} onDeleteClass={removeClass} />}
      <TaskDialog open={editing !== null} initial={editing} courses={courses} tz={tz} onClose={() => setEditing(null)}
        onSave={input => { const id = editing!.id; setEditing(null); edit(id, input) }}
        onDone={() => { const t = editing!; setEditing(null); finish(t) }}
        onDelete={() => { const t = editing!; setEditing(null); remove(t) }} />
    </div>
  )
}
