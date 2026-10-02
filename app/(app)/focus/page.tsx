'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Pause, Play, SkipForward, Headphones } from 'lucide-react'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { listSessionsSince, logFocusSession } from '@/lib/data/focus'
import { dailyMinutes } from '@/lib/streak'
import { localDayKey, startOfLocalDay } from '@/lib/dates'
import {
  createTimer, durationFor, elapsedMs, isFinished, markLogged, nextMode, pauseTimer, remainingMs,
  shouldLogSession, startTimer, type Mode, type TimerState,
} from '@/lib/timer'
import { usePersistedTimer } from '@/lib/ui/usePersistedTimer'

const MODE_LABEL: Record<Mode, string> = { focus: 'Focus', short: 'Short break', long: 'Long break' }
const SOUNDS = [{ id: 'off', label: 'Off' }, { id: 'rain', label: 'Rain' }, { id: 'cafe', label: 'Café' }, { id: 'lofi', label: 'Lo-fi' }]
const fmt = (ms: number) => { const s = Math.ceil(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` }

export default function FocusPage() {
  const { profile } = useProfile()
  const toast = useToast()
  const tz = profile.timezone
  const { timer, setTimer, completedFocus, setCompletedFocus } =
    usePersistedTimer(() => createTimer('focus', durationFor('focus', profile)), tz)
  const [now, setNow] = useState(() => Date.now())
  const [todayMinutes, setTodayMinutes] = useState(0)
  const [sound, setSound] = useState('off')
  const [volume, setVolume] = useState(0.6)
  const [soundError, setSoundError] = useState(false)
  const audio = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const today = localDayKey(new Date(), tz)
    listSessionsSince(supabase(), startOfLocalDay(today, tz))
      .then(s => setTodayMinutes(dailyMinutes(s, tz).get(today) ?? 0))
  }, [tz])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    const onVisible = () => setNow(Date.now())
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  const log = useCallback(async (t: TimerState, at: number, completed: boolean) => {
    const minutes = Math.round(elapsedMs(t, at) / 60_000)
    try {
      await logFocusSession(supabase(), { startedAt: new Date(t.firstStartedAt ?? at), endedAt: new Date(at), minutes, completed })
      setTodayMinutes(m => m + minutes)
    } catch {
      toast('Couldn\'t save this session.', { label: 'Retry', onClick: () => void log(t, at, completed) })
    }
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
    }
    advance(timer, count)
  }, [now, timer, completedFocus, log, advance])

  function toggle() {
    const t = Date.now()
    setTimer(s => (s.startedAt === null ? startTimer(s, t) : pauseTimer(s, t)))
  }

  function skip() {
    const t = Date.now()
    if (shouldLogSession(timer, t)) void log(markLogged(timer), t, false)
    advance(timer, completedFocus) // a skipped focus session doesn't count toward the long break
  }

  function pickMode(mode: Mode) {
    const t = Date.now()
    if (shouldLogSession(timer, t)) void log(markLogged(timer), t, false)
    setTimer(createTimer(mode, durationFor(mode, profile)))
  }

  useEffect(() => {
    const a = audio.current
    if (!a) return
    a.volume = volume
    if (sound === 'off') { a.pause(); return }
    setSoundError(false)
    a.src = `/sounds/${sound}.mp3`
    a.play().catch(() => setSoundError(true))
  }, [sound, volume])

  const remaining = remainingMs(timer, now)
  const pct = 1 - remaining / timer.durationMs
  const R = 88, C = 2 * Math.PI * R
  const running = timer.startedAt !== null
  const goal = profile.daily_goal_minutes
  const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`)

  useEffect(() => { document.title = running ? `${fmt(remaining)} · ${MODE_LABEL[timer.mode]}` : 'Studyhub' }, [running, remaining, timer.mode])

  return (
    <div className="mx-auto max-w-md text-center">
      <div role="tablist" className="flex justify-center gap-1">
        {(['focus', 'short', 'long'] as Mode[]).map(m => (
          <button key={m} role="tab" aria-selected={timer.mode === m} onClick={() => pickMode(m)}
            className={`rounded-lg px-3 py-1 text-sm ${timer.mode === m ? 'bg-surface font-medium' : 'text-muted'}`}>{MODE_LABEL[m]}</button>
        ))}
      </div>
      <div className="relative mx-auto my-6 size-56">
        <svg viewBox="0 0 200 200" className="size-full -rotate-90" aria-hidden>
          <circle cx="100" cy="100" r={R} fill="none" stroke="var(--surface)" strokeWidth="8" />
          <circle cx="100" cy="100" r={R} fill="none" stroke="var(--accent)" strokeWidth="8" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - pct)} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-mono text-4xl font-medium" aria-live="off">{fmt(remaining)}</div>
          {timer.mode === 'focus' && <div className="text-sm text-muted">Session {(completedFocus % profile.long_break_every) + 1} of {profile.long_break_every}</div>}
        </div>
      </div>
      <div className="flex justify-center gap-2">
        <button className="btn-primary min-w-28" onClick={toggle}>
          {running ? <><Pause size={14} aria-hidden />Pause</> : <><Play size={14} aria-hidden />{timer.accumulatedMs ? 'Resume' : 'Start'}</>}
        </button>
        <button className="btn" onClick={skip}><SkipForward size={14} aria-hidden />Skip</button>
      </div>

      <div className="card mx-auto mt-6 flex flex-wrap items-center gap-2 text-sm">
        <Headphones size={16} aria-hidden className="text-muted" />
        {SOUNDS.map(s => (
          <button key={s.id} onClick={() => setSound(s.id)} aria-pressed={sound === s.id}
            className={`rounded-lg px-2.5 py-1 ${sound === s.id ? 'bg-surface font-medium' : 'text-muted'}`}>{s.label}</button>
        ))}
        <input aria-label="Volume" type="range" min="0" max="1" step="0.05" value={volume} onChange={e => setVolume(Number(e.target.value))} className="min-w-20 flex-1" />
        {soundError && <p className="w-full text-left text-xs text-danger">This sound isn&apos;t available.</p>}
      </div>
      <audio ref={audio} loop preload="none" />
      <p className="mt-4 text-sm text-muted">Today {fmtMin(todayMinutes)} of {fmtMin(goal)} goal</p>
    </div>
  )
}
