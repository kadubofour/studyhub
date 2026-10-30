'use client'
import Link from 'next/link'
import { Pause, Play, RotateCcw } from 'lucide-react'

// The focus timer, in the right of Home's greeting card, so that side is useful and the timer is one tap from the top of the page
export function HeroFocus({ mode, clock, running, resumable, onToggle, onRestart }: { mode: string; clock: string; running: boolean; resumable: boolean; onToggle: () => void; onRestart?: () => void }) {
  // With Restart beside it, on a phone the main button is a round icon too, so both fit beside the clock (its word stays for screen readers)
  const compact = !!onRestart && (resumable || running)
  const word = compact ? 'max-sm:sr-only' : ''
  return (
    // On a phone it is one row on the card itself: the session and the clock on the left, its buttons on the right
    <div data-hero-focus className="w-full rounded-2xl bg-black/20 px-5 py-3.5 text-center max-sm:flex max-sm:items-center max-sm:justify-between max-sm:gap-2 max-sm:bg-transparent max-sm:p-0 max-sm:text-left sm:w-auto">
      <div>
        <div className="font-display text-sm font-semibold opacity-90">{mode}</div>
        <div className="font-mono text-4xl font-semibold tracking-tight max-sm:text-[2.75rem] max-sm:leading-none">{clock}</div>
      </div>
      <div className="mt-2.5 flex justify-center gap-2 max-sm:mt-0">
        <button type="button" onClick={onToggle} aria-label={running ? 'Pause' : resumable ? 'Resume' : 'Start focus'} className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-xl bg-white px-4 text-sm font-medium text-[var(--accent-solid)] max-sm:h-11 max-sm:rounded-full transition hover:brightness-95 ${compact ? 'max-sm:w-11 max-sm:justify-center max-sm:px-0' : 'max-sm:px-5'}`}>
          {running ? <><Pause size={14} aria-hidden /><span className={word}>Pause</span></> : <><Play size={14} aria-hidden />{resumable ? <span className={word}>Resume</span> : <>Start<span className="max-sm:sr-only"> focus</span></>}</>}
        </button>
        {onRestart && (resumable || running) && <button type="button" onClick={onRestart} aria-label="Restart" title="Start this session over" className="inline-flex h-9 items-center rounded-xl bg-white/15 px-3 max-sm:size-11 max-sm:justify-center max-sm:rounded-full max-sm:px-0 text-sm font-medium transition hover:bg-white/25"><RotateCcw size={14} aria-hidden /></button>}
        {/* on a phone the top bar's timer opens Focus */}
        <Link href="/focus" className="max-sm:hidden inline-flex h-9 items-center whitespace-nowrap rounded-xl bg-white/15 px-3.5 text-sm font-medium transition hover:bg-white/25">Open</Link>
      </div>
    </div>
  )
}
