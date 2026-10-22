'use client'
import Link from 'next/link'
import { Pause, Play, RotateCcw } from 'lucide-react'

// The focus timer on Home: the time left, large, and the one button that starts it
export function HeroFocus({ mode, clock, running, resumable, onToggle, onRestart }: { mode: string; clock: string; running: boolean; resumable: boolean; onToggle: () => void; onRestart?: () => void }) {
  return (
    <div className="w-full">
      <div className="text-sm font-medium text-muted">{mode}</div>
      <div className="font-display text-[3.25rem] font-semibold leading-none tracking-tight tabular-nums">{clock}</div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={onToggle} className="btn-primary">
          {running ? <><Pause size={14} aria-hidden />Pause</> : <><Play size={14} aria-hidden />{resumable ? 'Resume' : 'Start focus'}</>}
        </button>
        {onRestart && (resumable || running) && <button type="button" onClick={onRestart} aria-label="Restart" title="Start this session over" className="btn"><RotateCcw size={14} aria-hidden /></button>}
        <Link href="/focus" className="btn">Open</Link>
      </div>
    </div>
  )
}
