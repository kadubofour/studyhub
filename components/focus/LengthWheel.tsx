'use client'
import { useEffect, useRef } from 'react'
import { MAX_SECONDS, MIN_SECONDS } from '@/lib/timer'

const ROW = 44 // px per number
const ROWS = 5 // numbers in view: the one chosen, and two either side
const clamp = (n: number) => Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, Math.round(n)))

// One drum: numbers that scroll and snap, the one in the middle band is the choice. A spinbutton for keyboards and screen readers.
function Drum({ label, unit, value, min, max, step, onChange }: { label: string; unit: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const settle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const numbers = Array.from({ length: max - min + 1 }, (_, i) => min + i)

  // Follow the value when it changes by other means (a key, "Back to usual", another length being set): wind the drum to it
  useEffect(() => {
    const el = box.current
    if (el && Math.abs(el.scrollTop - (value - min) * ROW) > 1) el.scrollTop = (value - min) * ROW
  }, [value, min])
  useEffect(() => () => clearTimeout(settle.current), [])

  const onScroll = () => {
    clearTimeout(settle.current)
    settle.current = setTimeout(() => {
      const el = box.current
      if (!el) return
      const v = Math.min(max, Math.max(min, min + Math.round(el.scrollTop / ROW)))
      if (v !== value) onChange(v)
    }, 90)
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    const to = e.key === 'ArrowUp' ? value - 1 : e.key === 'ArrowDown' ? value + 1 : e.key === 'PageUp' ? value - step : e.key === 'PageDown' ? value + step
      : e.key === 'Home' ? min : e.key === 'End' ? max : null
    if (to === null) return
    e.preventDefault()
    onChange(Math.min(max, Math.max(min, to)))
  }

  return (
    <div className="relative w-[5.5rem]">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-xl bg-surface" style={{ height: ROW }} />
      <div ref={box} role="spinbutton" tabIndex={0} aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={`${value} ${unit}`}
        onScroll={onScroll} onKeyDown={onKeyDown} style={{ height: ROW * ROWS }}
        className="no-scrollbar relative snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent [mask-image:linear-gradient(transparent,black_35%,black_65%,transparent)]" >
        <div style={{ height: ROW * 2 }} aria-hidden />
        {numbers.map(n => (
          <div key={n} aria-hidden onClick={() => box.current?.scrollTo({ top: (n - min) * ROW, behavior: 'smooth' })}
            style={{ height: ROW }} className={`flex cursor-pointer snap-center items-center justify-center pr-6 font-mono text-3xl tabular-nums ${n === value ? 'font-semibold text-fg' : 'text-muted'}`}>
            {String(n).padStart(2, '0')}
          </div>
        ))}
        <div style={{ height: ROW * 2 }} aria-hidden />
      </div>
      <span aria-hidden className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-sm text-muted">{unit}</span>
    </div>
  )
}

// How long the session about to start is, set like the timer on a phone: hours, minutes and seconds on three drums. The length is in seconds.
export function LengthWheel({ seconds, onChange }: { seconds: number; onChange: (seconds: number) => void }) {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return (
    <div role="group" aria-label="Session length" className="flex items-center justify-center gap-1">
      <Drum label="Hours" unit="hr" value={hours} min={0} max={Math.floor(MAX_SECONDS / 3600)} step={1} onChange={h => onChange(clamp(h * 3600 + mins * 60 + secs))} />
      <Drum label="Minutes" unit="min" value={mins} min={0} max={59} step={5} onChange={m => onChange(clamp(hours * 3600 + m * 60 + secs))} />
      <Drum label="Seconds" unit="sec" value={secs} min={0} max={59} step={5} onChange={x => onChange(clamp(hours * 3600 + mins * 60 + x))} />
    </div>
  )
}
