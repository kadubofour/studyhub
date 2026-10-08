'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatInTimeZone } from 'date-fns-tz'
import { Layers, Play, Pause, BarChart3, Settings, ListChecks, School, ArrowRight } from 'lucide-react'
import { TaskRow } from '@/components/planner/TaskRow'
import { QuickAdd } from '@/components/planner/QuickAdd'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useSaver } from '@/components/providers/ToastProvider'
import { fmtClock, MODE_LABEL, useFocus } from '@/components/providers/FocusProvider'
import { supabase } from '@/lib/supabase/client'
import { listCourses } from '@/lib/data/courses'
import { greetingFont } from '@/lib/appearance'
import { AiError } from '@/components/ai/AiError'
import { SessionRow } from '@/components/plan/SessionRow'
import { usePlans } from '@/components/plan/usePlans'
import { useWarmup } from '@/components/plan/useWarmup'
import { countTasksDoneSince, createTask, listOpenTasks, setTaskDone, type NewTask } from '@/lib/data/tasks'
import { listClasses } from '@/lib/data/classes'
import { countDueCards } from '@/lib/data/cards'
import { listSessionsSince } from '@/lib/data/focus'
import { bucketTasks, endOfLocalDay, localDayKey, startOfLocalDay, weekKeysFor, weekdayOfKey } from '@/lib/dates'
import { dailyMinutes } from '@/lib/streak'
import { remainingMs } from '@/lib/timer'
import { nextClass } from '@/lib/timetable'
import type { ClassSlot, Course, Task } from '@/lib/types'

const DAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const greeting = (hour: number) => (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening')
const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ''}`.trim() : `${m}m`)

export default function HomePage() {
  const { profile } = useProfile()
  const save = useSaver()
  const focus = useFocus()
  const tz = profile.timezone
  const [courses, setCourses] = useState<Course[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set())
  const [doneBefore, setDoneBefore] = useState(0)
  const [classes, setClasses] = useState<ClassSlot[]>([])
  const [due, setDue] = useState(0)
  const [week, setWeek] = useState<Map<string, number>>(new Map())
  const plans = usePlans()
  const warmup = useWarmup()

  useEffect(() => {
    const sb = supabase()
    const today = localDayKey(new Date(), tz)
    const weekStart = startOfLocalDay(weekKeysFor(today)[0], tz)
    Promise.all([
      listCourses(sb), listOpenTasks(sb), listClasses(sb), countDueCards(sb, new Date()),
      countTasksDoneSince(sb, startOfLocalDay(today, tz)), listSessionsSince(sb, weekStart),
    ]).then(([c, t, cl, d, done, sessions]) => {
      setCourses(c); setTasks(t); setClasses(cl); setDue(d); setDoneBefore(done); setWeek(dailyMinutes(sessions, tz))
    })
  }, [tz])

  const now = new Date()
  const todayKey = localDayKey(now, tz)
  const { overdue, today } = bucketTasks(tasks, tz, now)
  const list = [...overdue, ...today]
  const sessions = (plans.views ?? []).flatMap(v => v.today.map(s => ({ v, s })))
  const upcomingClass = nextClass(classes, tz, now)
  const courseOf = (id: string | null) => courses.find(c => c.id === id)
  const hour = Number(formatInTimeZone(now, tz, 'H'))
  const name = profile.display_name ? `, ${profile.display_name}` : ''
  const doneToday = doneBefore + doneIds.size
  const goal = profile.daily_goal_minutes
  const focusPct = Math.min(100, Math.round((focus.todayMinutes / goal) * 100))
  const running = focus.timer.startedAt !== null
  const weekKeys = weekKeysFor(todayKey)
  const maxWeek = Math.max(goal, ...weekKeys.map(k => week.get(k) ?? 0), 1)

  function toggle(t: Task) {
    const wasDone = doneIds.has(t.id)
    // Explicit values (not a flip) so a late rollback or Retry can't leave UI and DB disagreeing
    const setDone = (done: boolean) => (s: Set<string>) => { const n = new Set(s); if (done) n.add(t.id); else n.delete(t.id); return n }
    save(() => setDoneIds(setDone(!wasDone)), () => setDoneIds(setDone(wasDone)), () => setTaskDone(supabase(), t.id, !wasDone))
  }

  function add(input: NewTask) {
    // Tasks added from Home are due today unless the text names another day
    const withDate = { ...input, due_at: input.due_at ?? endOfLocalDay(todayKey, tz).toISOString() }
    const temp: Task = { id: `temp-${crypto.randomUUID()}`, course_id: null, title: input.title, type: 'other', due_at: withDate.due_at, priority: 'normal', done_at: null, created_at: now.toISOString() }
    save(
      () => setTasks(ts => [...ts, temp]),
      () => setTasks(ts => ts.filter(x => x.id !== temp.id)),
      async () => { const real = await createTask(supabase(), withDate); setTasks(ts => ts.map(x => (x.id === temp.id ? real : x))) },
    )
  }

  const nextCourse = upcomingClass && courseOf(upcomingClass.cls.course_id)
  const nextLabel = upcomingClass && (
    upcomingClass.dayKey === todayKey
      ? upcomingClass.cls.start_time.slice(0, 5)
      : `${formatInTimeZone(new Date(`${upcomingClass.dayKey}T12:00:00Z`), 'UTC', 'EEE')} ${upcomingClass.cls.start_time.slice(0, 5)}`
  )

  return (
    <div className="space-y-4">
      <section className="hero">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm opacity-85">{formatInTimeZone(now, tz, 'EEEE, MMM d')}</p>
            <h1 className="mt-0.5 text-2xl font-semibold" style={{ fontFamily: greetingFont(profile.look, profile.font) }}>{greeting(hour)}{name}</h1>
          </div>
          <div className="flex gap-1 md:hidden">
            <Link href="/progress" aria-label="Progress" className="rounded-lg p-1.5 hover:bg-white/15"><BarChart3 size={17} aria-hidden /></Link>
            <Link href="/settings" aria-label="Settings" className="rounded-lg p-1.5 hover:bg-white/15"><Settings size={17} aria-hidden /></Link>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/25" role="progressbar" aria-valuenow={focusPct} aria-valuemin={0} aria-valuemax={100} aria-label="Focus goal progress">
            <div className="h-2 rounded-full bg-white transition-all" style={{ width: `${focusPct}%` }} />
          </div>
          <span className="text-sm">{fmtMin(focus.todayMinutes)} of {fmtMin(goal)} focus</span>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="tile tile-a">
          <div className="tile-label"><ListChecks size={14} className="text-success" aria-hidden />Tasks today</div>
          <div className="tile-value">{doneToday} <span className="text-sm font-normal text-muted">/ {doneToday + list.length - doneIds.size}</span></div>
        </div>
        <Link href={due > 0 ? '/review' : '/flashcards'} className="tile tile-b transition hover:border-accent">
          <div className="tile-label"><Layers size={14} className="text-[#D4537E]" aria-hidden />Cards due</div>
          <div className="tile-value flex items-center gap-1">{due}{due > 0 && <ArrowRight size={15} className="text-muted" aria-hidden />}</div>
        </Link>
        <Link href="/planner" className="tile tile-c col-span-2 transition hover:border-accent md:col-span-1">
          <div className="tile-label"><School size={14} className="text-[#BA7517]" aria-hidden />Next class</div>
          <div className="mt-1 truncate font-medium">
            {nextCourse ? <><span style={{ color: nextCourse.color }}>{nextCourse.name}</span> · {nextLabel}</> : <span className="text-muted">No classes yet</span>}
          </div>
        </Link>
      </section>

      <section className="grid gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="card">
          <h2 className="section-label">Today</h2>
          {sessions.map(({ v, s }) => (
            <SessionRow key={s.id} s={s} course={courseOf(v.courseId)} done={!!s.done_at}
              onToggle={() => plans.setDone(v.plan.id, s.id, !s.done_at)} onWarmup={() => { void warmup.start(s) }} warmingUp={warmup.busy === s.id} />
          ))}
          {warmup.error && <AiError code={warmup.error.code} message={warmup.error.message} />}
          {list.length === 0 && sessions.length === 0 && <p className="py-2 text-sm text-muted">Nothing due today. Add something below.</p>}
          {list.map(t => (
            <TaskRow key={t.id} task={t} course={courseOf(t.course_id)} tz={tz} now={now} done={doneIds.has(t.id)} onToggle={() => toggle(t)} showType={false} />
          ))}
          <QuickAdd courses={courses} defaultCourseId={null} tz={tz} onAdd={add} compact implicitDue="Today" />
        </div>

        <div className="space-y-4">
          <div className="card text-center">
            <h2 className="section-label">{MODE_LABEL[focus.timer.mode]}</h2>
            <div className="font-mono text-4xl font-semibold tracking-tight">{fmtClock(remainingMs(focus.timer, focus.now))}</div>
            <div className="mt-3 flex justify-center gap-2">
              <button className="btn-primary" onClick={focus.toggle}>
                {running ? <><Pause size={14} aria-hidden />Pause</> : <><Play size={14} aria-hidden />{focus.timer.accumulatedMs ? 'Resume' : 'Start focus'}</>}
              </button>
              <Link href="/focus" className="btn">Open</Link>
            </div>
          </div>
          <div className="card">
            <h2 className="section-label">This week</h2>
            <div className="flex h-24 items-end gap-2" role="img" aria-label="Focus minutes per day this week">
              {weekKeys.map(k => {
                const m = week.get(k) ?? 0
                const isToday = k === todayKey
                return (
                  <div key={k} className="flex flex-1 flex-col items-center gap-1" title={`${k}: ${fmtMin(m)}`}>
                    <div className="w-full rounded-md transition-all"
                      style={{ height: `${Math.max(4, (m / maxWeek) * 72)}px`, background: isToday ? 'var(--accent-solid)' : 'color-mix(in srgb, var(--accent) 28%, transparent)' }} />
                    <span className={`text-[10px] ${isToday ? 'font-semibold text-accent' : 'text-muted'}`}>{DAY_LETTER[weekdayOfKey(k)]}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
