'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatInTimeZone } from 'date-fns-tz'
import { Layers, Play, BarChart3, Settings } from 'lucide-react'
import { CourseDot } from '@/components/ui/CourseDot'
import { TaskRow } from '@/components/planner/TaskRow'
import { QuickAdd } from '@/components/planner/QuickAdd'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useSaver } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { listCourses } from '@/lib/data/courses'
import { createTask, listOpenTasks, setTaskDone, type NewTask } from '@/lib/data/tasks'
import { listClasses } from '@/lib/data/classes'
import { countDueCards } from '@/lib/data/cards'
import { bucketTasks, endOfLocalDay, localDayKey } from '@/lib/dates'
import { nextClass } from '@/lib/timetable'
import type { ClassSlot, Course, Task } from '@/lib/types'

function greeting(hour: number) {
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
}

export default function HomePage() {
  const { profile } = useProfile()
  const save = useSaver()
  const tz = profile.timezone
  const [courses, setCourses] = useState<Course[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set())
  const [classes, setClasses] = useState<ClassSlot[]>([])
  const [due, setDue] = useState(0)

  useEffect(() => {
    const sb = supabase()
    Promise.all([listCourses(sb), listOpenTasks(sb), listClasses(sb), countDueCards(sb, new Date())])
      .then(([c, t, cl, d]) => { setCourses(c); setTasks(t); setClasses(cl); setDue(d) })
  }, [])

  const now = new Date()
  const { overdue, today } = bucketTasks(tasks, tz, now)
  const list = [...overdue, ...today]
  const upcomingClass = nextClass(classes, tz, now)
  const courseOf = (id: string | null) => courses.find(c => c.id === id)
  const hour = Number(formatInTimeZone(now, tz, 'H'))
  const name = profile.display_name ? `, ${profile.display_name}` : ''

  function toggle(t: Task) {
    const wasDone = doneIds.has(t.id)
    const flip = (s: Set<string>) => { const n = new Set(s); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n }
    save(() => setDoneIds(flip), () => setDoneIds(flip), () => setTaskDone(supabase(), t.id, !wasDone))
  }

  function add(input: NewTask) {
    // Tasks added from Home are due today unless the text names another day
    const withDate = { ...input, due_at: input.due_at ?? endOfLocalDay(localDayKey(now, tz), tz).toISOString() }
    const temp: Task = { id: `temp-${crypto.randomUUID()}`, course_id: null, title: input.title, type: 'other', due_at: withDate.due_at, priority: 'normal', done_at: null, created_at: now.toISOString() }
    save(
      () => setTasks(ts => [...ts, temp]),
      () => setTasks(ts => ts.filter(x => x.id !== temp.id)),
      async () => { const real = await createTask(supabase(), withDate); setTasks(ts => ts.map(x => (x.id === temp.id ? real : x))) },
    )
  }

  const nextCourse = upcomingClass && courseOf(upcomingClass.cls.course_id)
  const nextLabel = upcomingClass && (
    upcomingClass.dayKey === localDayKey(now, tz)
      ? upcomingClass.cls.start_time.slice(0, 5)
      : `${formatInTimeZone(new Date(`${upcomingClass.dayKey}T12:00:00Z`), 'UTC', 'EEE')} ${upcomingClass.cls.start_time.slice(0, 5)}`
  )

  return (
    <div className="max-w-md">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-medium">{greeting(hour)}{name}</h1>
          <p className="text-muted">{formatInTimeZone(now, tz, 'EEEE, MMM d')}</p>
        </div>
        <div className="flex gap-1 md:hidden">
          <Link href="/progress" aria-label="Progress" className="btn-ghost"><BarChart3 size={16} aria-hidden /></Link>
          <Link href="/settings" aria-label="Settings" className="btn-ghost"><Settings size={16} aria-hidden /></Link>
        </div>
      </div>

      <h2 className="mb-1 text-xs text-muted">Today</h2>
      {list.length === 0 && <p className="py-2 text-sm text-muted">Nothing due today.</p>}
      {list.map(t => (
        <TaskRow key={t.id} task={t} course={courseOf(t.course_id)} tz={tz} now={now} done={doneIds.has(t.id)} onToggle={() => toggle(t)} showType={false} />
      ))}
      <QuickAdd courses={courses} defaultCourseId={null} tz={tz} onAdd={add} compact />

      <div className="mt-6 flex flex-wrap gap-2">
        {upcomingClass && nextCourse && (
          <Link href="/planner" className="btn"><CourseDot color={nextCourse.color} />{nextCourse.name} · {nextLabel}</Link>
        )}
        {due > 0 && <Link href="/review" className="btn"><Layers size={14} aria-hidden />Review {due} cards</Link>}
        <Link href="/focus" className="btn"><Play size={14} aria-hidden />Focus</Link>
      </div>
    </div>
  )
}
