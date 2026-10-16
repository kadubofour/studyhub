'use client'
import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { MAX_MINUTES, MIN_MINUTES } from '@/lib/timer'

export { MAX_MINUTES, MIN_MINUTES }

const clamp = (m: number) => Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(m)))

/** The next multiple of five in that direction (23 goes to 25 or 20), so the buttons land on tidy lengths from any length */
export function stepMinutes(minutes: number, dir: 1 | -1): number {
  return clamp(dir > 0 ? (Math.floor(minutes / 5) + 1) * 5 : (Math.ceil(minutes / 5) - 1) * 5)
}

// How long the session about to start is: any length, from the one the student set in Settings (`usual`). Steps of five, or type it.
export function LengthStepper({ minutes, usual, disabled, onChange }: { minutes: number; usual: number; disabled: boolean; onChange: (minutes: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null) // what is being typed, until Enter or leaving the box

  const commit = () => {
    const typed = Number(draft)
    setDraft(null)
    if (draft !== null && draft.trim() !== '' && Number.isFinite(typed)) onChange(clamp(typed))
  }
  const btn = 'inline-flex size-9 items-center justify-center rounded-full border border-line bg-raised text-muted transition hover:bg-surface hover:text-fg disabled:opacity-40 disabled:hover:bg-raised pointer-coarse:size-11'

  return (
    <div role="group" aria-label="Session length" className="flex flex-wrap items-center justify-center gap-2">
      <button type="button" className={btn} disabled={disabled || minutes <= MIN_MINUTES} aria-label="Five minutes shorter" onClick={() => onChange(stepMinutes(minutes, -1))}><Minus size={16} aria-hidden /></button>
      <label className="flex items-baseline gap-1.5 rounded-xl border border-line bg-raised px-3 py-1.5 text-sm focus-within:ring-2 focus-within:ring-accent">
        <input type="number" inputMode="numeric" min={MIN_MINUTES} max={MAX_MINUTES} aria-label="Session length in minutes" disabled={disabled}
          value={draft ?? String(minutes)} onChange={e => setDraft(e.target.value)} onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setDraft(null) }}
          className="w-12 border-0 bg-transparent p-0 text-center font-medium tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
        <span className="text-muted" aria-hidden>min</span>
      </label>
      <button type="button" className={btn} disabled={disabled || minutes >= MAX_MINUTES} aria-label="Five minutes longer" onClick={() => onChange(stepMinutes(minutes, 1))}><Plus size={16} aria-hidden /></button>
      {!disabled && minutes !== usual && (
        <button type="button" onClick={() => onChange(usual)} className="rounded-lg px-2 py-1 text-xs text-muted underline-offset-2 hover:text-fg hover:underline">Back to {usual} min</button>
      )}
    </div>
  )
}
