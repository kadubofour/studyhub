'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatInTimeZone } from 'date-fns-tz'
import { Layers, Play, Pause, BarChart3, Settings, School, ArrowRight, Flame, FolderOpen, User, BookOpen } from 'lucide-react'
import { TaskRow } from '@/components/planner/TaskRow'
import { QuickAdd } from '@/components/planner/QuickAdd'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useSaver } from '@/components/providers/ToastProvider'
import { fmtClock, MODE_LABEL, useFocus } from '@/components/providers/FocusProvider'
import { supabase } from '@/lib/supabase/client'
import { listCourses } from '@/lib/data/courses'
import { greetingFont } from '@/lib/appearance'
import { useLook } from '@/components/providers/useLook'
import { HeroFocus } from '@/components/home/HeroFocus'
import { CourseAccess } from '@/components/home/CourseAccess'
import { HomeActions } from '@/components/home/HomeActions'
import { homeMaterial, type Recent, type CourseCounts } from '@/lib/home/material'
import { listNotes } from '@/lib/data/notes'
import { listDecks } from '@/lib/data/decks'
import { listLectures } from '@/lib/data/lectures'
import { WeakSpotsCard } from '@/components/topics/WeakSpotsCard'
import { useXp } from '@/components/xp/useXp'
import { GoalRing } from '@/components/home/GoalRing'
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
  const [material, setMaterial] = useState<{ counts: CourseCounts; recent: Recent[] }>({ counts: {}, recent: [] })
  const { xp, reload: reloadXp } = useXp(focus.todayMinutes)
  const plans = usePlans(reloadXp)
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
  // Course material is read on its own, so a slow list never holds up the rest of Home
  useEffect(() => {
    const sb = supabase()
    Promise.all([listNotes(sb), listDecks(sb), listLectures(sb)]).then(([n, d, l]) => setMaterial(homeMaterial(n, d, l))).catch(() => {})
  }, [])

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
  // Every look but Paper shows the goal as a ring beside the timer; Paper has a bar, and the timer in its own card
  const look = useLook()
  const bold = look !== 'paper'
  const weekKeys = weekKeysFor(todayKey)
  const maxWeek = Math.max(goal, ...weekKeys.map(k => week.get(k) ?? 0), 1)

  function toggle(t: Task) {
    const wasDone = doneIds.has(t.id)
    // Explicit values (not a flip) so a late rollback or Retry can't leave UI and DB disagreeing
    const setDone = (done: boolean) => (s: Set<string>) => { const n = new Set(s); if (done) n.add(t.id); else n.delete(t.id); return n }
    save(() => setDoneIds(setDone(!wasDone)), () => setDoneIds(setDone(wasDone)), async () => { await setTaskDone(supabase(), t.id, !wasDone); reloadXp() })
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
    <div className="space-y-6">
      <section aria-label="Welcome" className="hero hero-page">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[15px] opacity-85">{formatInTimeZone(now, tz, 'EEEE, MMMM d')}</p>
            <h1 className="font-display mt-1 text-[2.25rem] font-semibold leading-[1.05] tracking-tight sm:text-[2.75rem]" style={{ fontFamily: greetingFont(look, profile.font) }}>{greeting(hour)}{name}</h1>
          </div>
          {/* phones have no sidebar: the places it holds are a tap away here */}
          <div className="-ml-2 flex gap-0.5 md:hidden">
            <Link href="/courses" aria-label="Courses" className="rounded-lg p-2.5 hover:bg-white/15"><BookOpen size={18} aria-hidden /></Link>
            <Link href="/library" aria-label="Library" className="rounded-lg p-2.5 hover:bg-white/15"><FolderOpen size={18} aria-hidden /></Link>
            <Link href="/profile" aria-label="Profile" className="rounded-lg p-2.5 hover:bg-white/15"><User size={18} aria-hidden /></Link>
            <Link href="/progress" aria-label="Progress" className="rounded-lg p-2.5 hover:bg-white/15"><BarChart3 size={18} aria-hidden /></Link>
            <Link href="/settings" aria-label="Settings" className="rounded-lg p-2.5 hover:bg-white/15"><Settings size={18} aria-hidden /></Link>
          </div>
        </div>
        {bold ? (
          <div className="mt-7 flex flex-wrap items-center justify-between gap-6">
            <GoalRing percent={focusPct} label={`${fmtMin(focus.todayMinutes)} of ${fmtMin(goal)} focus`} />
            <HeroFocus mode={MODE_LABEL[focus.timer.mode]} clock={fmtClock(remainingMs(focus.timer, focus.now))} running={running} resumable={focus.timer.accumulatedMs > 0} onToggle={focus.toggle} onRestart={focus.restart} />
            {xp && look === 'playful' && (
              <div className="flex flex-wrap gap-2 text-sm font-medium">
                <span className="rounded-full bg-black/25 px-3 py-1">Level {xp.level.level}</span>
                <span className="rounded-full bg-black/25 px-3 py-1">{xp.total} XP</span>
                {xp.streak > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-black/25 px-3 py-1"><Flame size={14} aria-hidden />{xp.streak}-day streak</span>}
              </div>
            )}
          </div>
        ) : (<>
          <div className="mt-5 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/25" role="progressbar" aria-valuenow={focusPct} aria-valuemin={0} aria-valuemax={100} aria-label="Focus goal progress">
              <div className="h-2 rounded-full bg-white transition-all" style={{ width: `${focusPct}%` }} />
            </div>
            <span className="text-sm">{fmtMin(focus.todayMinutes)} of {fmtMin(goal)} focus</span>
          </div>
          {xp && <p className="mt-2 text-sm opacity-90">Level {xp.level.level} · {xp.total} XP{xp.streak > 0 && ` · ${xp.streak}-day streak`}</p>}
        </>)}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section aria-label="Today" className="card">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 className="section-label !mb-0">Today</h2>
            <span className="text-sm text-muted">{doneToday} of {doneToday + list.length - doneIds.size} done</span>
          </div>
          {(nextCourse || due > 0) && (
            <ul className="mb-4 space-y-2 text-[15px]">
              {nextCourse && <li><Link href="/planner" className="inline-flex items-center gap-2.5 hover:text-accent"><School size={17} className="text-muted" aria-hidden />Next class: {nextCourse.name}, {nextLabel}</Link></li>}
              {due > 0 && <li><Link href="/review" className="inline-flex items-center gap-2.5 font-medium text-accent hover:underline"><Layers size={17} aria-hidden />{due} {due === 1 ? 'card' : 'cards'} to review<ArrowRight size={15} aria-hidden /></Link></li>}
            </ul>
          )}
          {sessions.map(({ v, s }) => (
            <SessionRow key={s.id} s={s} course={courseOf(v.courseId)} done={!!s.done_at}
              onToggle={() => plans.setDone(v.plan.id, s.id, !s.done_at)} onWarmup={() => { void warmup.start(s) }} warmingUp={warmup.busy === s.id} />
          ))}
          {warmup.error && <AiError code={warmup.error.code} message={warmup.error.message} />}
          {list.length === 0 && sessions.length === 0 && <p className="py-2 text-[15px] text-muted">Nothing due today. Add something below.</p>}
          {list.map(t => (
            <TaskRow key={t.id} task={t} course={courseOf(t.course_id)} tz={tz} now={now} done={doneIds.has(t.id)} onToggle={() => toggle(t)} showType={false} />
          ))}
          <QuickAdd courses={courses} defaultCourseId={null} tz={tz} onAdd={add} compact implicitDue="Today" />
        </section>

        <div className="flex flex-col gap-6">
          {!bold && (
            <section aria-label="Focus" className="card text-center">
              <h2 className="section-label">{MODE_LABEL[focus.timer.mode]}</h2>
              <div className="font-display text-5xl font-semibold tabular-nums tracking-tight">{fmtClock(remainingMs(focus.timer, focus.now))}</div>
              <div className="mt-4 flex justify-center gap-2">
                <button type="button" className="btn-primary" onClick={focus.toggle}>
                  {running ? <><Pause size={14} aria-hidden />Pause</> : <><Play size={14} aria-hidden />{focus.timer.accumulatedMs ? 'Resume' : 'Start focus'}</>}
                </button>
                <Link href="/focus" className="btn">Open</Link>
              </div>
            </section>
          )}
          <section aria-label="This week" className="card flex flex-1 flex-col">
            <h2 className="section-label">This week</h2>
            <div className="mt-auto flex h-32 items-end gap-2.5" role="img" aria-label="Focus minutes per day this week">
              {weekKeys.map(k => {
                const m = week.get(k) ?? 0
                const isToday = k === todayKey
                return (
                  <div key={k} className="flex flex-1 flex-col items-center gap-1.5" title={`${k}: ${fmtMin(m)}`}>
                    <div className="w-full rounded-md transition-all"
                      style={{ height: `${Math.max(6, (m / maxWeek) * 100)}px`, background: isToday ? 'var(--accent-solid)' : 'color-mix(in srgb, var(--accent) 26%, transparent)' }} />
                    <span className={`text-xs ${isToday ? 'font-semibold text-accent' : 'text-muted'}`}>{DAY_LETTER[weekdayOfKey(k)]}</span>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      </div>

      {/* phones have no sidebar: there, Home is where these are reached */}
      <div className="md:hidden"><HomeActions /></div>

      <CourseAccess courses={courses} counts={material.counts} recent={material.recent} coursesClassName="md:hidden" />

      <WeakSpotsCard courses={courses} />
    </div>
  )
}
