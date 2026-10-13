'use client'
import Link from 'next/link'
import { Pause, Play } from 'lucide-react'

// The focus timer, in the right of Home's greeting card, so that side is useful and the timer is one tap from the top of the page
export function HeroFocus({ mode, clock, running, resumable, onToggle }: { mode: string; clock: string; running: boolean; resumable: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-2xl bg-black/20 px-5 py-3.5 text-center">
      <div className="text-xs font-medium uppercase tracking-wide opacity-85">{mode}</div>
      <div className="font-mono text-4xl font-semibold tracking-tight">{clock}</div>
      <div className="mt-2.5 flex justify-center gap-2">
        <button type="button" onClick={onToggle} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-4 text-sm font-medium text-[var(--accent-solid)] transition hover:brightness-95">
          {running ? <><Pause size={14} aria-hidden />Pause</> : <><Play size={14} aria-hidden />{resumable ? 'Resume' : 'Start focus'}</>}
        </button>
        <Link href="/focus" className="inline-flex h-9 items-center rounded-xl bg-white/15 px-3.5 text-sm font-medium transition hover:bg-white/25">Open</Link>
      </div>
    </div>
  )
}
