'use client'
import Link from 'next/link'
import { Pause, Play, RotateCcw } from 'lucide-react'

// The focus timer, in the right of Home's greeting card, so that side is useful and the timer is one tap from the top of the page
export function HeroFocus({ mode, clock, running, resumable, onToggle, onRestart }: { mode: string; clock: string; running: boolean; resumable: boolean; onToggle: () => void; onRestart?: () => void }) {
  return (
    // On a phone it is one pill along the bottom of the card, the clock on the left and its buttons on the right
    <div data-hero-focus className="w-full rounded-2xl bg-black/20 px-5 py-3.5 text-center max-sm:flex max-sm:items-center max-sm:justify-between max-sm:gap-3 max-sm:rounded-full max-sm:py-2 max-sm:pl-6 max-sm:pr-2 max-sm:text-left sm:w-auto">
      <div>
        <div className="font-display text-sm font-semibold opacity-90">{mode}</div>
        <div className="font-mono text-4xl font-semibold tracking-tight max-sm:text-3xl">{clock}</div>
      </div>
      <div className="mt-2.5 flex justify-center gap-2 max-sm:mt-0">
        <button type="button" onClick={onToggle} aria-label={running ? 'Pause' : resumable ? 'Resume' : 'Start focus'} className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-xl bg-white px-4 text-sm font-medium text-[var(--accent-solid)] max-sm:h-11 max-sm:rounded-full max-sm:px-5 transition hover:brightness-95">
          {running ? <><Pause size={14} aria-hidden />Pause</> : <><Play size={14} aria-hidden />{resumable ? 'Resume' : <>Start<span className="max-sm:sr-only"> focus</span></>}</>}
        </button>
        {onRestart && (resumable || running) && <button type="button" onClick={onRestart} aria-label="Restart" title="Start this session over" className="inline-flex h-9 items-center rounded-xl bg-white/15 px-3 max-sm:size-11 max-sm:justify-center max-sm:rounded-full max-sm:px-0 text-sm font-medium transition hover:bg-white/25"><RotateCcw size={14} aria-hidden /></button>}
        {/* on a phone the top bar's timer opens Focus */}
        <Link href="/focus" className="max-sm:hidden inline-flex h-9 items-center whitespace-nowrap rounded-xl bg-white/15 px-3.5 text-sm font-medium transition hover:bg-white/25">Open</Link>
      </div>
    </div>
  )
}
