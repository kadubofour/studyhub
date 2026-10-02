'use client'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useProfile } from './ProfileProvider'
import { useToast } from './ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { listSessionsSince, logFocusSession } from '@/lib/data/focus'
import { dailyMinutes } from '@/lib/streak'
import { localDayKey, startOfLocalDay } from '@/lib/dates'
import {
  createTimer, durationFor, elapsedMs, isFinished, markLogged, nextMode, pauseTimer, remainingMs,
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
    usePersistedTimer(() => createTimer('focus', durationFor('focus', profile)), tz)
  const [now, setNow] = useState(() => Date.now())
  const [todayMinutes, setTodayMinutes] = useState(0)

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
        await logFocusSession(supabase(), { startedAt: new Date(t.firstStartedAt ?? at), endedAt: new Date(at), minutes, completed })
        setTodayMinutes(m => m + minutes)
      } catch {
        toast('Couldn\'t save this session.', { label: 'Retry', onClick: () => void attempt() })
      }
    }
    return attempt()
  }, [toast])

  const advance = useCallback((from: TimerState, count: number) => {
    const mode = nextMode(from.mode, count, profile.long_break_every)
    setTimer(createTimer(mode, durationFor(mode, profile)))
  }, [profile, setTimer])

  // Finish: log once (markLogged makes a second pass a no-op), then move to the next mode
  useEffect(() => {
    if (timer.startedAt === null || !isFinished(timer, now)) return
    const finishedAt = timer.startedAt + (timer.durationMs - timer.accumulatedMs)
    let count = completedFocus
    if (timer.mode === 'focus') {
      count += 1
      setCompletedFocus(count)
      if (shouldLogSession(timer, now)) void log(markLogged(timer), finishedAt, true)
      toast('Focus session done. Time for a break.')
    }
    advance(timer, count)
  }, [now, timer, completedFocus, log, advance, setCompletedFocus, toast])

  const toggle = useCallback(() => {
    const t = Date.now()
    setTimer(s => (s.startedAt === null ? startTimer(s, t) : pauseTimer(s, t)))
  }, [setTimer])

  const skip = useCallback(() => {
    const t = Date.now()
    if (shouldLogSession(timer, t)) void log(markLogged(timer), t, false)
    advance(timer, completedFocus) // a skipped focus session doesn't count toward the long break
  }, [timer, log, advance, completedFocus])

  const pickMode = useCallback((mode: Mode) => {
    const t = Date.now()
    if (shouldLogSession(timer, t)) void log(markLogged(timer), t, false)
    setTimer(createTimer(mode, durationFor(mode, profile)))
  }, [timer, log, setTimer, profile])

  const running = timer.startedAt !== null
  const remaining = remainingMs(timer, now)
  useEffect(() => {
    document.title = running ? `${fmtClock(remaining)} · ${MODE_LABEL[timer.mode]}` : 'Studyhub'
  }, [running, remaining, timer.mode])

  return (
    <Ctx.Provider value={{ timer, now, completedFocus, todayMinutes, toggle, skip, pickMode }}>
      {children}
    </Ctx.Provider>
  )
}

export function useFocus() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useFocus outside FocusProvider')
  return v
}
