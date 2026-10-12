'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Flame, Layers, Pause, Play, School, Zap } from 'lucide-react'
import { MODE_LABEL, fmtClock, useFocus } from '@/components/providers/FocusProvider'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useXp } from '@/components/xp/useXp'
import { supabase } from '@/lib/supabase/client'
import { countDueCards } from '@/lib/data/cards'
import { listClasses } from '@/lib/data/classes'
import { listCourses } from '@/lib/data/courses'
import { classChip } from '@/lib/timetable'
import { remainingMs } from '@/lib/timer'
import { celebrate, rememberXp, seenXp, type Burst, type Snapshot } from '@/lib/xp/celebrate'
import { useProgressChanged } from '@/lib/xp/events'
import { useCoursesChanged, useTimetableChanged } from '@/lib/course/events'

const PAGES: [string, string][] = [
  ['/home', 'Home'], ['/planner', 'Planner'], ['/focus', 'Focus'], ['/progress', 'Progress'], ['/notes', 'Notes'], ['/lectures', 'Lectures'],
  ['/flashcards', 'Flashcards'], ['/review', 'Review'], ['/tutor', 'Tutor'], ['/settings', 'Settings'], ['/plans', 'Plans'], ['/library', 'Library'], ['/profile', 'Profile'], ['/courses', 'Courses'],
]
const pageName = (path: string) => PAGES.find(([p]) => path === p || path.startsWith(p + '/'))?.[1]
const chip = 'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium'

// A strip above every page (Classic and Vivid looks): the focus timer, cards due, the streak and the level, so they are one glance away
export function TopBar({ sidebarHidden = false }: { sidebarHidden?: boolean }) {
  const path = usePathname()
  const { timer, now, toggle } = useFocus()
  const { xp } = useXp(path) // read again on each page: a session finished on another page shows up here
  const [due, setDue] = useState<number | null>(null)
  // When XP has gone up since the last reading, cheer for a few seconds (set while rendering, the supported way to react to a changed value)
  const [seen, setSeen] = useState<Snapshot | null>(seenXp)
  const [burst, setBurst] = useState<Burst | null>(null)
  const now_ = xp ? { total: xp.total, level: xp.level.level } : null
  if (now_ && (!seen || seen.total !== now_.total || seen.level !== now_.level)) {
    setSeen(now_)
    const b = celebrate(seen, now_)
    if (b) setBurst(b)
  }
  useEffect(() => { if (seen) rememberXp(seen) }, [seen])
  useEffect(() => {
    if (!burst) return
    const t = setTimeout(() => setBurst(null), 4000)
    return () => clearTimeout(t)
  }, [burst])

  // Counted again on each page, and whenever a review or anything else says progress changed
  const [dueVersion, setDueVersion] = useState(0)
  useProgressChanged(() => setDueVersion(v => v + 1))
  useEffect(() => {
    let live = true
    countDueCards(supabase(), new Date()).then(n => { if (live) setDue(n) }).catch(() => { if (live) setDue(null) })
    return () => { live = false }
  }, [path, dueVersion])

  // The class period: the timetable and the course names once, and a clock that moves on every half minute even when no timer runs
  const { profile } = useProfile()
  const [timetable, setTimetable] = useState<{ classes: Awaited<ReturnType<typeof listClasses>>; courses: Awaited<ReturnType<typeof listCourses>> } | null>(null)
  const [clock30, setClock30] = useState(() => Date.now())
  // Read again when a class or course is added, renamed or deleted, so the chip is never stale
  const [timetableVersion, setTimetableVersion] = useState(0)
  useCoursesChanged(() => setTimetableVersion(v => v + 1))
  useTimetableChanged(() => setTimetableVersion(v => v + 1))
  useEffect(() => {
    let live = true
    Promise.all([listClasses(supabase()), listCourses(supabase())]).then(([classes, courses]) => { if (live) setTimetable({ classes, courses }) }).catch(() => {})
    const tick = setInterval(() => setClock30(Date.now()), 30_000)
    return () => { live = false; clearInterval(tick) }
  }, [timetableVersion])
  const period = timetable ? classChip(timetable.classes, timetable.courses, profile.timezone, new Date(clock30)) : null

  const running = timer.startedAt !== null
  const label = timer.mode === 'focus' ? 'focus' : MODE_LABEL[timer.mode].toLowerCase()
  const clock = fmtClock(remainingMs(timer, now))
  const verb = running ? 'Pause' : timer.accumulatedMs > 0 ? 'Resume' : 'Start'
  const name = pageName(path)

  return (
    <header aria-label="Today at a glance" className={`no-print sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-raised/95 px-4 py-2 backdrop-blur md:px-8 ${sidebarHidden ? 'md:pl-16' : ''}`}>
      {name && <span data-page className="hidden text-base font-semibold sm:block">{name}</span>}
      <div className="ml-auto flex min-w-0 items-center gap-2 overflow-x-auto">
        {burst && (
          <span className={`${chip} xp-pop ${burst.levelUp ? 'bg-accent-solid text-white' : 'tile-b text-fg'}`} aria-hidden>
            {burst.levelUp ? `Level up! Level ${burst.levelUp}` : `+${burst.gained} XP`}
          </span>
        )}
        <div className={`${chip} gap-2 bg-accent-soft py-1 pr-1 text-accent`}>
          <Link href="/focus" aria-label={`${MODE_LABEL[timer.mode]} timer, ${clock} left`} className="font-mono tabular-nums">{clock}</Link>
          <button type="button" onClick={toggle} aria-label={`${verb} ${label} timer`} className="flex size-7 items-center justify-center rounded-full bg-accent-solid text-white">
            {running ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />}
          </button>
        </div>
        {period && (
          <Link href="/planner" aria-label={period.label} className={`${chip} bg-surface text-fg`}>
            <School size={15} aria-hidden /><span aria-hidden className="sm:hidden">{period.short}</span><span aria-hidden className="hidden sm:inline">{period.label}</span>
          </Link>
        )}
        {due !== null && (
          <Link href={due > 0 ? '/review' : '/flashcards'} aria-label={due === 0 ? 'No cards due' : `${due} card${due === 1 ? '' : 's'} due`}
            className={`${chip} ${due > 0 ? 'tile-a text-fg' : 'bg-surface text-muted'}`}>
            <Layers size={15} aria-hidden /><span aria-hidden>{due === 0 ? <span className="hidden sm:inline">No cards due</span> : <><span className="sm:hidden">{due}</span><span className="hidden sm:inline">{due} card{due === 1 ? '' : 's'} due</span></>}</span>
          </Link>
        )}
        <span role="status" aria-live="polite" className="sr-only">
          {burst ? (burst.levelUp ? `Level up! You reached level ${burst.levelUp} (+${burst.gained} XP)` : `+${burst.gained} XP`) : ''}
        </span>
        {xp && xp.streak > 0 && <span role="img" aria-label={`${xp.streak}-day streak`} className={`${chip} tile-c text-fg`}><Flame size={15} aria-hidden /><span aria-hidden>{xp.streak}</span></span>}
        {xp && (
          <span className={`${chip} bg-surface text-fg`}>
            <Zap size={15} className="text-accent" aria-hidden /><span className="sm:hidden">Lv {xp.level.level}</span><span className="hidden sm:inline">Level {xp.level.level}</span>
            <span role="progressbar" aria-label={`Progress to level ${xp.level.level + 1}`} aria-valuenow={xp.level.into} aria-valuemin={0} aria-valuemax={xp.level.span} aria-valuetext={`${xp.level.into} of ${xp.level.span} XP`}
              className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-line sm:block">
              <span className="block h-full rounded-full bg-accent-solid" style={{ width: `${Math.round((xp.level.into / xp.level.span) * 100)}%` }} />
            </span>
          </span>
        )}
      </div>
    </header>
  )
}
