'use client'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { RemindersList } from '@/components/reminders/RemindersList'
import { REMINDERS_CHANGED, listReminders } from '@/lib/data/reminders'
import { nextOccurrence, type MyReminder } from '@/lib/reminders/mine'
import { CourseBar } from '@/components/planner/CourseBar'
import { QuickAdd } from '@/components/planner/QuickAdd'
import { StudyPlanPanel } from '@/components/plan/StudyPlanPanel'
import { TaskRow } from '@/components/planner/TaskRow'
import { TaskCard } from '@/components/planner/TaskCard'
import { TaskDialog } from '@/components/planner/TaskDialog'
import { CalendarView } from '@/components/calendar/CalendarView'
import { TimetableView } from '@/components/calendar/TimetableView'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useSaver, useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { listCourses } from '@/lib/data/courses'
import { createTask, deleteTask, listOpenTasks, listRecentlyDone, setTaskDone, updateTask, type NewTask } from '@/lib/data/tasks'
import { createClass, deleteClass, listClasses, updateClass } from '@/lib/data/classes'
import { boardColumns, boardSummary, rescheduleTo, type MoveChoice } from '@/lib/tasks/board'
import { keepTimeOfDay } from '@/lib/exams'
import { LISTS, listCounts, taskGroups, tasksForList, type ListId } from '@/lib/tasks/lists'
import { TaskRail, type TypeFilter } from '@/components/planner/TaskRail'
import type { ClassSlot, Course, Task } from '@/lib/types'
import { useScanSaved } from '@/lib/scan/events'
import { PAGE_TITLE } from '@/components/ui/PageHeader'

type Tab = 'tasks' | 'week' | 'timetable'
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
  const [list, setList] = useState<ListId>('all')
  const [filter, setFilter] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [loaded, setLoaded] = useState(false)
  const [classes, setClasses] = useState<ClassSlot[]>([])
  const [editing, setEditing] = useState<Task | null>(null)
  // The student's own reminders are one more list here; ?list=reminders opens on it (a reminder about nothing leads here)
  const askedList = useSearchParams().get('list')
  const [reminding, setReminding] = useState(askedList === 'reminders')
  const [seenList, setSeenList] = useState(askedList)
  if (askedList !== seenList) { setSeenList(askedList); if (askedList === 'reminders') { setTab('tasks'); setReminding(true) } }
  const [mine, setMine] = useState<MyReminder[]>([])
  useEffect(() => {
    let live = true
    const read = () => { listReminders(supabase()).then(r => { if (live) setMine(r) }).catch(() => {}) }
    read()
    window.addEventListener(REMINDERS_CHANGED, read)
    return () => { live = false; window.removeEventListener(REMINDERS_CHANGED, read) }
  }, [])
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
  const columns = boardColumns(visible, tz, now)
  const courseOf = (id: string | null) => courses.find(c => c.id === id)
  const typeCounts = { all: byCourse.length, other: 0, assignment: 0, exam: 0, reading: 0 } as Record<TypeFilter, number>
  for (const t of byCourse) typeCounts[t.type]++
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
      exam_kind: input.exam_kind ?? null, duration_min: input.duration_min ?? null, location: input.location ?? null, covers: input.covers ?? null, weight_pct: input.weight_pct ?? null,
    }
    save(
      () => setTasks(ts => [...ts, temp]),
      () => setTasks(ts => ts.filter(t => t.id !== temp.id)),
      async () => {
        const real = await createTask(supabase(), input)
        setTasks(ts => ts.map(t => (t.id === temp.id ? real : t)))
        // An exam is for studying towards: offer to plan the revision, which is on the Tasks tab
        if (real.type === 'exam') toast('Exam added.', { label: 'Plan revision', onClick: () => setTab('tasks') })
      },
    )
  }

  function edit(id: string, patch: NewTask) {
    const before = tasks.find(t => t.id === id)
    if (!before || id.startsWith('temp-')) return
    const change = { title: patch.title, type: patch.type ?? before.type, course_id: patch.course_id ?? null, due_at: patch.due_at ?? null, priority: patch.priority ?? before.priority }
    // the exam details change when the patch carries them (an exam's patch always does, with nulls for what was cleared)
    for (const k of ['exam_kind', 'duration_min', 'location', 'covers', 'weight_pct'] as const) if (k in patch) (change as Record<string, unknown>)[k] = patch[k] ?? null
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

  function move(t: Task, to: MoveChoice) {
    // an exam keeps the time it starts at; other tasks go to the end of the day
    edit(t.id, { title: t.title, type: t.type, course_id: t.course_id, priority: t.priority, due_at: keepTimeOfDay(t, rescheduleTo(to, tz, now), tz) })
  }
  const counts = listCounts(visible, visibleDone.length, tz, now)
  const shown = tasksForList(list, visible, tz, now)
  const groups = taskGroups(shown, tz, now)
  const row = (t: Task) => (
    <TaskCard key={t.id} task={t} course={courseOf(t.course_id)} tz={tz} now={now} onToggle={() => finish(t)} onEdit={() => setEditing(t)} onMove={to => move(t, to)} onDelete={() => remove(t)} />
  )
  const title = LISTS.find(l => l.id === list)!.label
  const subtitle = list === 'done' ? `${visibleDone.length} finished in the last ${DONE_DAYS} days`
    : list === 'someday' ? `${counts.someday} without a date`
    : list === 'upcoming' ? `${counts.upcoming} coming up`
    : boardSummary(columns)
  const EMPTY: Record<ListId, string> = { all: 'No open tasks. Add one above.', today: 'Nothing due today', upcoming: 'Nothing coming up', someday: 'Tasks without a date wait here', done: `Nothing finished in the last ${DONE_DAYS} days` }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-3 md:mb-8 md:gap-y-4">
        <h1 className={PAGE_TITLE}>Planner</h1>
        <div role="tablist" className="flex gap-1">
          {(['tasks', 'week', 'timetable'] as Tab[]).map(t => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`rounded-xl px-3.5 py-1.5 text-sm pointer-coarse:py-2.5 ${tab === t ? 'bg-surface font-medium' : 'text-muted hover:text-fg'}`}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div className="w-full md:ml-auto md:w-auto [&>div]:!mb-0">
          <CourseBar courses={courses} selected={filter} onSelect={setFilter} onChange={next => {
            setCourses(next)
            listOpenTasks(supabase()).then(setTasks) // course deletion may have changed tasks
            listRecentlyDone(supabase(), new Date(Date.now() - DONE_DAYS * 86_400_000)).then(setDone).catch(() => {})
            listClasses(supabase()).then(setClasses)
          }} />
        </div>
      </div>

      {tab === 'tasks' && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[15rem_minmax(0,1fr)]">
          <TaskRail list={reminding ? null : list} onList={l => { setReminding(false); setList(l) }} counts={counts} type={typeFilter} onType={setTypeFilter} typeCounts={typeCounts}
            reminders={{ count: mine.filter(r => nextOccurrence(r, now, tz)).length, on: reminding, onOpen: () => setReminding(true) }} />
          {reminding ? (
            <div className="min-w-0">
              <div className="mb-5">
                <h2 className="font-display text-[1.6rem] font-semibold leading-tight tracking-tight">Reminders</h2>
                <p className="mt-0.5 text-sm text-muted">Yours, once or repeating. Also made with “Remind me” on a task, a note or a deck.</p>
              </div>
              <RemindersList tz={tz} />
            </div>
          ) : (
          <div className="min-w-0">
            <div className="mb-5">
              <h2 className="font-display text-[1.6rem] font-semibold leading-tight tracking-tight max-lg:sr-only">{title}</h2>
              <p className="mt-0.5 text-sm text-muted" aria-live="polite">{subtitle}</p>
            </div>
            {list !== 'done' && <QuickAdd variant="card" courses={courses} defaultCourseId={filter} tz={tz} onAdd={add} />}
            {loaded && courses.length === 0 && tasks.length === 0 && (
              <p className="mb-3 text-sm text-muted">Add your first course with “+ Course”, then add tasks above.</p>
            )}
            {list === 'done' ? (
              visibleDone.length === 0 ? <p className="rounded-2xl bg-surface px-4 py-8 text-center text-sm text-muted">{EMPTY.done}</p> : (
                <div className="card divide-y divide-line overflow-hidden p-0">
                  {visibleDone.map(t => <TaskRow key={t.id} task={t} course={courseOf(t.course_id)} tz={tz} now={now} done onToggle={() => reopen(t)} />)}
                </div>
              )
            ) : groups.length === 0 ? (
              <p className="rounded-2xl bg-surface px-4 py-8 text-center text-sm text-muted">{EMPTY[list]}</p>
            ) : (
              <div className="space-y-4">
                {groups.map(g => (
                  <section key={g.key} aria-label={g.label} className="overflow-hidden rounded-2xl border border-line bg-raised">
                    <h3 className={`font-display flex items-center justify-between px-5 pb-1.5 pt-4 text-sm font-semibold ${g.tone === 'danger' ? 'text-danger' : g.tone === 'today' ? 'text-accent' : 'text-muted'}`}>{g.label}<span className="font-normal text-muted">{g.tasks.length}</span></h3>
                    <div className="divide-y divide-line">{g.tasks.map(row)}</div>
                  </section>
                ))}
              </div>
            )}
            {list !== 'done' && <div className="mt-6 [&>section]:!mt-0"><StudyPlanPanel courses={courses} tasks={tasks} /></div>}
          </div>
          )}
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
