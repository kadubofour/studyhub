'use client'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useProfile } from './ProfileProvider'
import { useToast } from './ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { listSessionsSince, logFocusSession } from '@/lib/data/focus'
import { setTaskDone } from '@/lib/data/tasks'
import { focusPrefs, useFocusPrefs } from '@/lib/focus/prefs'
import { useWakeLock } from '@/lib/focus/wakeLock'
import { setFocusTask, useFocusTask, type FocusTask } from '@/lib/focus/task'
import { chime, notify, primeAudio, vibrate } from '@/lib/focus/alert'
import { dailyMinutes } from '@/lib/streak'
import { localDayKey, startOfLocalDay } from '@/lib/dates'
import {
  createTimer, durationFor, MAX_MINUTES, MIN_MINUTES, elapsedMs, isFinished, markLogged, nextMode, pauseTimer, remainingMs, restartTimer,
  shouldLogSession, startTimer, type Mode, type TimerState,
} from '@/lib/timer'
import { usePersistedTimer } from '@/lib/ui/usePersistedTimer'

export const MODE_LABEL: Record<Mode, string> = { focus: 'Focus', short: 'Short break', long: 'Long break' }
export const fmtClock = (ms: number) => { const s = Math.ceil(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` }

interface FocusCtx {
  timer: TimerState
  now: number
  completedFocus: number
  todayMinutes: number
  toggle: () => void
  restart: () => void
  /** Change the length of the session about to start (only before any of it has gone) */
  setDuration: (minutes: number) => void
  /** What the student is working on, if they said */
  task: FocusTask | null
  skip: () => void
  pickMode: (mode: Mode) => void
}
const Ctx = createContext<FocusCtx | null>(null)

// Lives in the app layout so a running session keeps counting, finishes and is logged
// even while the user is on Notes, Flashcards, etc.
export function FocusProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useProfile()
  const toast = useToast()
  const tz = profile.timezone
  const { timer, setTimer, completedFocus, setCompletedFocus } =
    usePersistedTimer(() => createTimer('focus', durationFor('focus', profile)), tz, profile.id)
  const [now, setNow] = useState(() => Date.now())
  const [todayMinutes, setTodayMinutes] = useState(0)
  // What the student is working on: saved with the sessions that are logged
  const task = useFocusTask(profile.id)
  const taskRef = useRef(task)
  useEffect(() => { taskRef.current = task })
  // The tab's title says "time's up" while the student is away, until they come back
  const [alertTitle, setAlertTitle] = useState<string | null>(null)
  useEffect(() => {
    if (!alertTitle) return
    const back = () => { if (document.visibilityState === 'visible') setAlertTitle(null) }
    document.addEventListener('visibilitychange', back)
    window.addEventListener('focus', back)
    return () => { document.removeEventListener('visibilitychange', back); window.removeEventListener('focus', back) }
  }, [alertTitle])

  useEffect(() => {
    const today = localDayKey(new Date(), tz)
    listSessionsSince(supabase(), startOfLocalDay(today, tz))
      .then(s => setTodayMinutes(dailyMinutes(s, tz).get(today) ?? 0))
      .catch(() => {})
  }, [tz])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    const onVisible = () => setNow(Date.now())
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  const log = useCallback((t: TimerState, at: number, completed: boolean) => {
    const minutes = Math.round(elapsedMs(t, at) / 60_000)
    const attempt = async (): Promise<void> => {
      try {
        await logFocusSession(supabase(), { startedAt: new Date(t.firstStartedAt ?? at), endedAt: new Date(at), minutes, completed, taskId: taskRef.current?.id ?? null, courseId: taskRef.current?.course_id ?? null })
        setTodayMinutes(m => m + minutes)
      } catch {
        toast('Couldn\'t save this session.', { label: 'Retry', onClick: () => void attempt() })
      }
    }
    return attempt()
  }, [toast])

  // `auto` is a session that ran out by itself: with "start the next one automatically" on, the next one starts running
  const advance = useCallback((from: TimerState, count: number, auto = false) => {
    const mode = nextMode(from.mode, count, profile.long_break_every)
    const next = createTimer(mode, durationFor(mode, profile))
    setTimer(auto && focusPrefs.get().autoStart ? startTimer(next, Date.now()) : next)
  }, [profile, setTimer])

  // Time is up: the chime, the vibration and the notification the student chose, a title for the tab, and a message on the page
  const timeUp = useCallback((mode: Mode) => {
    const prefs = focusPrefs.get()
    const done = mode === 'focus'
    const title = done ? 'Focus session done' : 'Break over'
    if (prefs.sound) { chime(); vibrate() }
    if (prefs.notify) notify(title, done ? 'Time for a break.' : 'Ready to focus?')
    if (document.visibilityState !== 'visible') setAlertTitle(`⏰ ${title}`)
    const t = taskRef.current
    if (done) {
      toast('Focus session done. Time for a break.', t ? {
        label: `Mark “${t.title.length > 30 ? `${t.title.slice(0, 30)}…` : t.title}” done`,
        onClick: () => { setTaskDone(supabase(), t.id, true).then(() => { setFocusTask(null); toast(`Marked “${t.title}” done.`) }).catch(() => toast('Couldn\'t mark it done.')) },
      } : undefined)
    } else toast('Break over. Ready to focus?')
  }, [toast])

  // Finish: log once (markLogged makes a second pass a no-op), then move to the next mode
  useEffect(() => {
    if (timer.startedAt === null || !isFinished(timer, now)) return
    const finishedAt = timer.startedAt + (timer.durationMs - timer.accumulatedMs)
    let count = completedFocus
    if (timer.mode === 'focus') {
      count += 1
      setCompletedFocus(count)
      if (shouldLogSession(timer, now)) void log(markLogged(timer), finishedAt, true)
    }
    // the clock running out is a change in the world, not in this component: the page has to react to it
    // eslint-disable-next-line react-hooks/set-state-in-effect
    timeUp(timer.mode)
    advance(timer, count, true)
  }, [now, timer, completedFocus, log, advance, timeUp, setCompletedFocus])

  const toggle = useCallback(() => {
    primeAudio() // a tap is what lets the page make a sound later, when time is up
    const t = Date.now()
    setTimer(s => (s.startedAt === null ? startTimer(s, t) : pauseTimer(s, t)))
  }, [setTimer])

  const skip = useCallback(() => {
    const t = Date.now()
    if (shouldLogSession(timer, t)) void log(markLogged(timer), t, false)
    advance(timer, completedFocus) // a skipped focus session doesn't count toward the long break
  }, [timer, log, advance, completedFocus])

  // Start this session over from the full time. What was done so far is logged first (as a session not completed), like skipping.
  const restart = useCallback(() => {
    const t = Date.now()
    if (elapsedMs(timer, t) === 0) return
    if (shouldLogSession(timer, t)) void log(markLogged(timer), t, false)
    setTimer(restartTimer(timer, t))
  }, [timer, log, setTimer])

  const setDuration = useCallback((minutes: number) => {
    if (timer.startedAt !== null || elapsedMs(timer, Date.now()) > 0) return // not once it has begun
    setTimer(createTimer(timer.mode, Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(minutes))) * 60_000))
  }, [timer, setTimer])

  const pickMode = useCallback((mode: Mode) => {
    if (mode === timer.mode) return // re-clicking the current mode must not wipe the session
    const t = Date.now()
    if (shouldLogSession(timer, t)) void log(markLogged(timer), t, false)
    setTimer(createTimer(mode, durationFor(mode, profile)))
  }, [timer, log, setTimer, profile])

  const running = timer.startedAt !== null
  const keepAwake = useFocusPrefs().keepAwake
  useWakeLock(running && keepAwake) // the screen stays on while a session counts down
  const remaining = remainingMs(timer, now)
  // After a reload nothing has been tapped, and a page cannot make sound until something is: the first tap anywhere unlocks the chime
  useEffect(() => {
    if (!running) return
    const unlock = () => primeAudio()
    document.addEventListener('pointerdown', unlock, { once: true })
    return () => document.removeEventListener('pointerdown', unlock)
  }, [running])

  useEffect(() => {
    document.title = alertTitle ?? (running ? `${fmtClock(remaining)} · ${MODE_LABEL[timer.mode]}` : 'Studyhub')
  }, [running, remaining, timer.mode, alertTitle])

  return (
    <Ctx.Provider value={{ timer, now, completedFocus, todayMinutes, toggle, restart, setDuration, task, skip, pickMode }}>
      {children}
    </Ctx.Provider>
  )
}

export function useFocus() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useFocus outside FocusProvider')
  return v
}
