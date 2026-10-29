'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatInTimeZone } from 'date-fns-tz'
import { Bell, Layers, Play, Pause, BarChart3, Settings, School, ArrowRight, FolderOpen, BookOpen } from 'lucide-react'
import { Avatar } from '@/components/profile/Avatar'
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
import { todayLine } from '@/lib/home/todayLine'
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
import { REMINDERS_CHANGED, listReminders } from '@/lib/data/reminders'
import { nextOccurrence, type MyReminder } from '@/lib/reminders/mine'

// Home's shortcuts on a phone, which has no sidebar (Profile is the avatar beside the greeting)
const SHORTCUTS = [
  { href: '/courses', label: 'Courses', icon: BookOpen },
  { href: '/library', label: 'Library', icon: FolderOpen },
  { href: '/progress', label: 'Progress', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
]
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
  // the student's own reminders, for the ones still to come today
  const [mine, setMine] = useState<MyReminder[]>([])
  useEffect(() => {
    let live = true
    const read = () => { listReminders(supabase()).then(r => { if (live) setMine(r) }).catch(() => {}) }
    read()
    window.addEventListener(REMINDERS_CHANGED, read)
    return () => { live = false; window.removeEventListener(REMINDERS_CHANGED, read) }
  }, [])
  const { reload: reloadXp } = useXp(focus.todayMinutes) // the level, XP and streak are in the top bar
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
  const maxWeek = Math.max(goal * 1.25, ...weekKeys.map(k => week.get(k) ?? 0), 1)
  const weekTotal = weekKeys.reduce((sum, k) => sum + (week.get(k) ?? 0), 0)

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
  const remindersToday = mine.map(r => ({ r, at: nextOccurrence(r, now, tz) })).filter((x): x is { r: MyReminder; at: Date } => !!x.at && localDayKey(x.at, tz) === todayKey).sort((a, b) => a.at.getTime() - b.at.getTime())
  const nextLabel = upcomingClass && (
    upcomingClass.dayKey === todayKey
      ? upcomingClass.cls.start_time.slice(0, 5)
      : `${formatInTimeZone(new Date(`${upcomingClass.dayKey}T12:00:00Z`), 'UTC', 'EEE')} ${upcomingClass.cls.start_time.slice(0, 5)}`
  )

  return (
    <div className="space-y-6">
      {/* On a phone the greeting sits on the page with the student's avatar, the shortcuts are a row of pills and the goal and timer are one coloured card (globals.css, .home-hero) */}
      <section aria-label="Welcome" className="hero hero-page home-hero">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-[1.875rem] font-semibold leading-[1.05] tracking-tight max-md:text-[1.625rem] sm:text-[2.75rem]" style={{ fontFamily: greetingFont(look, profile.font) }}>{greeting(hour)}{name}</h1>
            {/* the date after the greeting, and today's one fact from the data */}
            <p className="mt-2 text-[15px] opacity-90 max-md:mt-1 max-md:text-sm max-md:text-muted max-md:opacity-100">{`${formatInTimeZone(now, tz, 'EEEE, MMMM d')} · ${todayLine({ overdue: overdue.filter(t => !doneIds.has(t.id)).length, dueToday: today.filter(t => !doneIds.has(t.id)).length, reminders: remindersToday.length, done: doneToday })}`}</p>
          </div>
          <Link href="/profile" aria-label="Profile" className="shrink-0 rounded-full ring-2 ring-raised md:hidden"><Avatar name={profile.display_name} color={profile.avatar_color} size={44} /></Link>
        </div>
        {/* phones have no sidebar: the places it holds are a tap away here */}
        <div className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5 md:hidden">
          {SHORTCUTS.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-raised px-4 py-2 text-sm font-medium text-fg transition active:scale-[.97]">
              <Icon size={15} className="text-muted" aria-hidden />{label}
            </Link>
          ))}
        </div>
        {bold ? (
          <div className="home-hero-panel mt-5 flex flex-wrap items-center justify-between gap-4 sm:mt-7 sm:gap-6">
            <GoalRing percent={focusPct} label={`${fmtMin(focus.todayMinutes)} of ${fmtMin(goal)} focus`} />
            <HeroFocus mode={MODE_LABEL[focus.timer.mode]} clock={fmtClock(remainingMs(focus.timer, focus.now))} running={running} resumable={focus.timer.accumulatedMs > 0} onToggle={focus.toggle} onRestart={focus.restart} />
          </div>
        ) : (<>
          <div className="home-hero-panel mt-5 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/25" role="progressbar" aria-valuenow={focusPct} aria-valuemin={0} aria-valuemax={100} aria-label="Focus goal progress">
              <div className="h-2 rounded-full bg-white transition-[width]" style={{ width: `${focusPct}%` }} />
            </div>
            <span className="text-sm">{fmtMin(focus.todayMinutes)} of {fmtMin(goal)} focus</span>
          </div>
        </>)}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section aria-label="Today" className="card">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 className="section-label !mb-0">Today</h2>
            <span className="text-sm text-muted">{doneToday} of {doneToday + list.length - doneIds.size} done</span>
          </div>
          {remindersToday.length > 0 && (
            <ul aria-label="Reminders today" className="mb-4 space-y-2 text-[15px]">
              {remindersToday.map(({ r, at }) => (
                <li key={r.id}><Link href={r.href || '/planner?list=reminders'} className="inline-flex items-center gap-2.5 hover:text-accent">
                  <Bell size={17} className="text-accent" aria-hidden /><span className="font-medium tabular-nums">{formatInTimeZone(at, tz, 'HH:mm')}</span><span className="text-muted" aria-hidden>·</span>{r.title}
                </Link></li>
              ))}
            </ul>
          )}
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
          {list.length === 0 && sessions.length === 0 && <p className="py-2 text-[15px] text-muted">{doneToday > 0 ? 'All done for today. Add something below if you like.' : 'Nothing due today. Add something below.'}</p>}
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
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h2 className="section-label !mb-0">This week</h2>
              <span className="text-sm tabular-nums text-muted">{fmtMin(weekTotal)} in all</span>
            </div>
            {/* focus per day on one scale: today in the student's colour, the other days in grey, the daily goal as a dashed line */}
            <div className="mt-auto" role="img" aria-label={`Focus minutes per day this week, against a goal of ${fmtMin(goal)} a day`}>
              <div className="relative flex h-[100px] items-end gap-2.5">
                <div data-goal-line aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-dashed border-muted/60 text-right text-xs leading-none text-muted" style={{ bottom: `${(goal / maxWeek) * 100}px` }}>
                  <span className="relative -top-4">Goal {fmtMin(goal)}</span>
                </div>
                {weekKeys.map(k => {
                  const m = week.get(k) ?? 0
                  const isToday = k === todayKey
                  return (
                    <div key={k} data-bar data-today={isToday || undefined} title={`${k}: ${fmtMin(m)}`} className="flex-1 rounded-t-[4px] transition-[height]"
                      style={{ height: `${m ? Math.max(3, (m / maxWeek) * 100) : 0}px`, background: isToday ? 'var(--accent-solid)' : 'color-mix(in srgb, var(--fg) 22%, transparent)' }} />
                  )
                })}
              </div>
              <div className="mt-1.5 flex gap-2.5 border-t border-line pt-1.5">
                {weekKeys.map(k => <span key={k} className={`flex-1 text-center text-xs ${k === todayKey ? 'font-semibold text-fg' : 'text-muted'}`}>{DAY_LETTER[weekdayOfKey(k)]}</span>)}
              </div>
            </div>
          </section>
        </div>
      </div>

      <HomeActions />

      <CourseAccess courses={courses} counts={material.counts} recent={material.recent} coursesClassName="md:hidden" />

      <WeakSpotsCard courses={courses} />
    </div>
  )
}
