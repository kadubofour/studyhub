'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Pause, Play, RotateCcw, SkipForward, Headphones, Maximize2 } from 'lucide-react'
import { useProfile } from '@/components/providers/ProfileProvider'
import { fmtClock, MODE_LABEL, useFocus } from '@/components/providers/FocusProvider'
import { canRestart, durationFor, elapsedMs, remainingMs, type Mode } from '@/lib/timer'
import { LengthWheel } from '@/components/focus/LengthWheel'
import { FocusTaskPicker } from '@/components/focus/FocusTaskPicker'
import { FocusFullscreen } from '@/components/focus/FocusFullscreen'
import { AMBIENT_SOUNDS, setAmbientPrefs, useAmbientPrefs } from '@/lib/focus/ambientPrefs'
import { focusShortcut } from '@/lib/focus/shortcuts'
import { modeClass } from '@/lib/focus/modeColors'

export default function FocusPage() {
  const { profile } = useProfile()
  const { timer, now, completedFocus, todayMinutes, toggle, restart, skip, pickMode, setDuration, task } = useFocus()
  const { sound, volume } = useAmbientPrefs() // played by the app layout, so it carries on when the student leaves this page
  const [full, setFull] = useState(false)

  // Keyboard: Space starts or pauses, R restarts, S skips, F opens full screen
  const keys = useRef({ toggle, restart, skip, canRestart: false })
  useEffect(() => { keys.current = { toggle, restart, skip, canRestart: canRestart(timer, now) } })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = focusShortcut(e)
      if (!k) return
      e.preventDefault()
      if (k === 'toggle') keys.current.toggle()
      else if (k === 'restart') { if (keys.current.canRestart) keys.current.restart() }
      else if (k === 'skip') keys.current.skip()
      else setFull(f => !f)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const remaining = remainingMs(timer, now)
  const pct = 1 - remaining / timer.durationMs
  const R = 88, C = 2 * Math.PI * R
  const running = timer.startedAt !== null
  const goal = profile.daily_goal_minutes
  const seconds = Math.round(timer.durationMs / 1000)
  const usual = Math.round(durationFor(timer.mode, profile) / 1000) // what the student set in Settings: where every session starts
  const usualWords = usual % 60 === 0 ? `${usual / 60} min` : `${Math.floor(usual / 60)}:${String(usual % 60).padStart(2, '0')}`
  const begun = running || elapsedMs(timer, now) > 0
  const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`)

  return (
    <div className={`mx-auto max-w-md text-center ${modeClass(timer.mode)}`}>
      <div role="tablist" className="flex justify-center gap-1">
        {(['focus', 'short', 'long'] as Mode[]).map(m => (
          <button key={m} role="tab" aria-selected={timer.mode === m} onClick={() => pickMode(m)}
            className={`rounded-lg px-3 py-1 text-sm pointer-coarse:py-2 ${timer.mode === m ? 'bg-accent-soft font-medium text-accent' : 'text-muted'}`}>{MODE_LABEL[m]}</button>
        ))}
      </div>
      {timer.mode === 'focus' && (
        <div className="mt-5 flex flex-col items-center gap-1.5">
          <div className="text-sm text-muted">Session {(completedFocus % profile.long_break_every) + 1} of {profile.long_break_every}</div>
          <div aria-hidden className="flex gap-1.5">
            {Array.from({ length: profile.long_break_every }, (_, i) => (
              <span key={i} className={`size-1.5 rounded-full ${i <= completedFocus % profile.long_break_every ? 'bg-accent-solid' : 'bg-line'}`} />
            ))}
          </div>
        </div>
      )}
      <div className="relative mx-auto my-6 size-[min(86vw,22rem)] sm:size-64">
        {begun ? (
          <>
            <svg viewBox="0 0 200 200" className="size-full -rotate-90" aria-hidden>
              <circle cx="100" cy="100" r={R} fill="none" stroke="var(--surface)" strokeWidth="10" />
              <defs><linearGradient id="ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="var(--accent-solid)" /><stop offset="100%" stopColor="var(--accent-glow)" /></linearGradient></defs>
              <circle cx="100" cy="100" r={R} fill="none" stroke="url(#ring)" strokeWidth="10" strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={C * (1 - pct)} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="font-mono text-5xl font-semibold tracking-tight max-sm:text-6xl" aria-live="off">{fmtClock(remaining)}</div>
              {timer.mode === 'focus' && task && <div className="mt-1 max-w-[11rem] truncate text-xs font-medium text-accent">{task.title}</div>}
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center"><LengthWheel seconds={seconds} onChange={setDuration} /></div>
        )}
      </div>
      {!begun && seconds !== usual && (
        <button type="button" onClick={() => setDuration(usual)} className="mb-4 rounded-lg px-2 py-1 text-xs text-muted underline-offset-2 hover:text-fg hover:underline">Back to {usualWords}</button>
      )}
      {timer.mode === 'focus' && <div className="mb-5"><FocusTaskPicker /></div>}
      <div className="flex flex-wrap justify-center gap-1.5 px-1 sm:gap-2 sm:px-3">
        <button className="btn-primary min-w-24 max-sm:!px-3 sm:min-w-28" onClick={toggle}>
          {running ? <><Pause size={14} aria-hidden />Pause</> : <><Play size={14} aria-hidden />{timer.accumulatedMs ? 'Resume' : 'Start'}</>}
        </button>
        <button className="btn max-sm:!px-2.5" onClick={restart} disabled={!canRestart(timer, now)} title="Start this session over"><RotateCcw size={14} aria-hidden />Restart</button>
        <button className="btn max-sm:!px-2.5" onClick={skip}><SkipForward size={14} aria-hidden />Skip</button>
        <button className="btn !px-2.5" onClick={() => setFull(true)} aria-label="Full screen" title="Full screen (F)"><Maximize2 size={14} aria-hidden /></button>
      </div>

      <p className="mt-6 text-center text-xs text-muted">Chime, notification and auto-start are in <Link href="/settings?section=reminders" className="underline underline-offset-2 hover:text-fg">Settings</Link>.</p>

      <div className="card mx-auto mt-4 flex flex-wrap items-center gap-2 text-sm">
        <Headphones size={16} aria-hidden className="text-muted" />
        {AMBIENT_SOUNDS.map(s => (
          <button key={s.id} onClick={() => setAmbientPrefs({ sound: s.id })} aria-pressed={sound === s.id}
            className={`rounded-lg px-2.5 py-1 pointer-coarse:py-2 ${sound === s.id ? 'bg-surface font-medium' : 'text-muted'}`}>{s.label}</button>
        ))}
        <input aria-label="Volume" type="range" min="0" max="1" step="0.05" value={volume} onChange={e => setAmbientPrefs({ volume: Number(e.target.value) })} className="min-w-20 flex-1 accent-[var(--accent-solid)]" />
      </div>
      {full && <FocusFullscreen onClose={() => setFull(false)} />}
      <p className="mt-4 text-sm text-muted">Today {fmtMin(todayMinutes)} of {fmtMin(goal)} goal</p>
    </div>
  )
}
