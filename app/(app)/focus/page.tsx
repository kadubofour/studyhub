'use client'
import { useEffect, useRef, useState } from 'react'
import { Pause, Play, SkipForward, Headphones } from 'lucide-react'
import { useProfile } from '@/components/providers/ProfileProvider'
import { fmtClock, MODE_LABEL, useFocus } from '@/components/providers/FocusProvider'
import { remainingMs, type Mode } from '@/lib/timer'

const SOUNDS = [{ id: 'off', label: 'Off' }, { id: 'rain', label: 'Rain' }, { id: 'cafe', label: 'Café' }, { id: 'lofi', label: 'Lo-fi' }]

export default function FocusPage() {
  const { profile } = useProfile()
  const { timer, now, completedFocus, todayMinutes, toggle, skip, pickMode } = useFocus()
  const [sound, setSound] = useState('off')
  const [volume, setVolume] = useState(0.6)
  const [soundError, setSoundError] = useState(false)
  const audio = useRef<HTMLAudioElement>(null)

  // Picking a sound (re)loads the loop; the volume effect below only adjusts the level
  useEffect(() => {
    const a = audio.current
    if (!a) return
    if (sound === 'off') { a.pause(); return }
    a.src = `/sounds/${sound}.mp3`
    a.play().catch(() => setSoundError(true))
  }, [sound])

  useEffect(() => {
    if (audio.current) audio.current.volume = volume
  }, [volume])

  const remaining = remainingMs(timer, now)
  const pct = 1 - remaining / timer.durationMs
  const R = 88, C = 2 * Math.PI * R
  const running = timer.startedAt !== null
  const goal = profile.daily_goal_minutes
  const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`)

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
          <div className="font-mono text-4xl font-medium" aria-live="off">{fmtClock(remaining)}</div>
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
          <button key={s.id} onClick={() => { setSoundError(false); setSound(s.id) }} aria-pressed={sound === s.id}
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
