'use client'
import { useEffect, useRef, useState } from 'react'
import { Minimize2, Pause, Play, RotateCcw, SkipForward } from 'lucide-react'
import { useProfile } from '@/components/providers/ProfileProvider'
import { fmtClock, MODE_LABEL, useFocus } from '@/components/providers/FocusProvider'
import { canRestart, remainingMs } from '@/lib/timer'

// The timer filling the window: a big countdown for a laptop propped up or a phone on the desk. It also asks the browser for real full screen where
// that is allowed, and closes when the student leaves it (Escape, or the browser's own way out).
export function FocusFullscreen({ onClose }: { onClose: () => void }) {
  const { profile } = useProfile()
  const { timer, now, completedFocus, toggle, restart, skip, task } = useFocus()
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose })
  const running = timer.startedAt !== null
  const every = profile.long_break_every
  const inSet = completedFocus % every

  const view = useRef<HTMLDivElement>(null)
  const [opener] = useState(() => document.activeElement as HTMLElement | null) // what to give focus back to: read before this view's own button takes it
  // Tab stays inside the view (the page behind is not reachable), and focus goes back to what opened it
  useEffect(() => {
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !view.current) return
      const all = Array.from(view.current.querySelectorAll<HTMLElement>('button:not(:disabled)'))
      if (all.length === 0) return
      const first = all[0], last = all[all.length - 1]
      const outside = !view.current.contains(document.activeElement)
      if (e.shiftKey && (document.activeElement === first || outside)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && (document.activeElement === last || outside)) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', trap)
    return () => { document.removeEventListener('keydown', trap); if (opener?.isConnected) opener.focus() }
  }, [opener])

  useEffect(() => {
    const root = document.documentElement
    let asked = false
    root.requestFullscreen?.().then(() => { asked = true }).catch(() => { /* not allowed here: the view still fills the window */ })
    const left = () => { if (asked && !document.fullscreenElement) close.current() }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') close.current() }
    document.addEventListener('fullscreenchange', left)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('fullscreenchange', left)
      document.removeEventListener('keydown', esc)
      asked = false
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    }
  }, [])

  const btn = 'inline-flex items-center gap-2 rounded-full border border-line bg-raised px-5 py-3 text-base transition hover:bg-surface disabled:opacity-40'
  return (
    <div ref={view} role="dialog" aria-modal="true" aria-label="Full screen timer" className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-bg px-6 text-center">
      <button type="button" onClick={onClose} aria-label="Exit full screen" title="Exit full screen" className="absolute right-4 top-4 inline-flex size-11 items-center justify-center rounded-full border border-line bg-raised text-muted hover:text-fg">
        <Minimize2 size={18} aria-hidden />
      </button>
      <div className="text-lg text-muted">{MODE_LABEL[timer.mode]}</div>
      <div className="font-mono text-[clamp(4rem,22vmin,16rem)] font-semibold leading-none tracking-tight" aria-live="off">{fmtClock(remainingMs(timer, now))}</div>
      {timer.mode === 'focus' && (
        <div className="flex flex-col items-center gap-2">
          <div className="text-base text-muted">Session {inSet + 1} of {every}</div>
          <div aria-hidden className="flex gap-2">
            {Array.from({ length: every }, (_, i) => <span key={i} className={`size-2 rounded-full ${i <= inSet ? 'bg-accent-solid' : 'bg-line'}`} />)}
          </div>
          {task && <div className="mt-1 max-w-[80vw] truncate text-lg font-medium text-accent">{task.title}</div>}
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" className="btn-primary min-w-36 !py-3 !text-base" onClick={toggle} autoFocus>
          {running ? <><Pause size={16} aria-hidden />Pause</> : <><Play size={16} aria-hidden />{timer.accumulatedMs ? 'Resume' : 'Start'}</>}
        </button>
        <button type="button" className={btn} onClick={restart} disabled={!canRestart(timer, now)}><RotateCcw size={16} aria-hidden />Restart</button>
        <button type="button" className={btn} onClick={skip}><SkipForward size={16} aria-hidden />Skip</button>
      </div>
    </div>
  )
}
