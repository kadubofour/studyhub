'use client'
import { useState } from 'react'
import type { PlanMode } from '@/lib/plan/types'

export type PlanSettings = { mode: PlanMode; minutesPerDay: number; daysOff: number[] }
const MODES: { value: PlanMode; label: string; blurb: string }[] = [
  { value: 'sprint', label: 'Sprint', blurb: 'The neediest 40% of topics. For a last push.' },
  { value: 'balanced', label: 'Balanced', blurb: 'Most topics (80%), with revision.' },
  { value: 'deep', label: 'Deep dive', blurb: 'Every topic, with extra revision.' },
]
// Monday first; the numbers are weekday numbers where 0 is Sunday
const DAYS: [number, string][] = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [0, 'Sun']]

export function PlanForm({ title, examLabel, initial, saving, error, onSave, onCancel }: {
  title: string; examLabel: string; initial?: PlanSettings; saving: boolean; error: string | null
  onSave: (s: PlanSettings) => void; onCancel: () => void
}) {
  const [mode, setMode] = useState<PlanMode>(initial?.mode ?? 'balanced')
  const [minutes, setMinutes] = useState(String(initial?.minutesPerDay ?? 45))
  const [off, setOff] = useState<number[]>(initial?.daysOff ?? [])
  const [problem, setProblem] = useState<string | null>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const m = Number(minutes)
    if (!Number.isInteger(m) || m < 10 || m > 240) { setProblem('Choose between 10 and 240 minutes.'); return }
    if (off.length >= 7) { setProblem('Leave at least one day to study.'); return }
    setProblem(null)
    onSave({ mode, minutesPerDay: m, daysOff: [...off].sort((a, b) => a - b) })
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3 rounded-xl border border-line p-3">
      <p className="text-sm font-medium">{title} · {examLabel}</p>
      <fieldset className="space-y-1.5">
        <legend className="mb-1 text-xs text-muted">Mode</legend>
        {MODES.map(m => (
          <label key={m.value} className="flex cursor-pointer items-start gap-2 text-sm">
            <input type="radio" name="mode" className="mt-1 accent-[var(--accent-solid)]" checked={mode === m.value} onChange={() => setMode(m.value)} />
            <span><span className="font-medium">{m.label}</span> <span className="text-muted">{m.blurb}</span></span>
          </label>
        ))}
      </fieldset>
      <label className="field max-w-40"><span>Minutes a day</span>
        <input type="number" min={10} max={240} step={5} value={minutes} onChange={e => setMinutes(e.target.value)} />
      </label>
      <fieldset>
        <legend className="mb-1 text-xs text-muted">Days off</legend>
        <div className="flex flex-wrap gap-3">
          {DAYS.map(([n, label]) => (
            <label key={n} className="flex items-center gap-1 text-sm">
              <input type="checkbox" className="accent-[var(--accent-solid)]" checked={off.includes(n)}
                onChange={e => setOff(o => (e.target.checked ? [...o, n] : o.filter(x => x !== n)))} />{label}
            </label>
          ))}
        </div>
      </fieldset>
      {(problem || error) && <p role="alert" className="text-sm text-danger">{problem ?? error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save plan'}</button>
      </div>
    </form>
  )
}
