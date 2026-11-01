'use client'
import { useState } from 'react'
import { Flame, Layers, Telescope, type LucideIcon } from 'lucide-react'
import type { PlanMode } from '@/lib/plan/types'
import { Dropdown } from '@/components/ui/Dropdown'

// examId: the exam the plan works towards, or null for a plan that keeps going without one
export type PlanSettings = { mode: PlanMode; minutesPerDay: number; daysOff: number[]; examId: string | null }
const MODES: { value: PlanMode; label: string; blurb: string; icon: LucideIcon }[] = [
  { value: 'sprint', label: 'Sprint', blurb: 'The neediest 40% of topics. For a last push.', icon: Flame },
  { value: 'balanced', label: 'Balanced', blurb: 'Most topics (80%), with revision.', icon: Layers },
  { value: 'deep', label: 'Deep dive', blurb: 'Every topic, with extra revision.', icon: Telescope },
]
const PRESETS = [20, 30, 45, 60, 90]
// Monday first; the numbers are weekday numbers where 0 is Sunday
const DAYS: [number, string][] = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [0, 'Sun']]

const heading = 'mb-2 block px-1 text-[13px] font-semibold uppercase tracking-wide text-muted'

// exams: the course's upcoming exams the plan can work towards; with none chosen it keeps going
export function PlanForm({ title, exams, initial, saving, error, onSave, onCancel }: {
  title: string; exams: { id: string; title: string }[]; initial?: Partial<PlanSettings>; saving: boolean; error: string | null
  onSave: (s: PlanSettings) => void; onCancel: () => void
}) {
  const [mode, setMode] = useState<PlanMode>(initial?.mode ?? 'balanced')
  const [minutes, setMinutes] = useState(String(initial?.minutesPerDay ?? 45))
  const [off, setOff] = useState<number[]>(initial?.daysOff ?? [])
  const [examId, setExamId] = useState(initial?.examId ?? '')
  const [problem, setProblem] = useState<string | null>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const m = Number(minutes)
    if (!Number.isInteger(m) || m < 10 || m > 240) { setProblem('Choose between 10 and 240 minutes.'); return }
    if (off.length >= 7) { setProblem('Leave at least one day to study.'); return }
    setProblem(null)
    onSave({ mode, minutesPerDay: m, daysOff: [...off].sort((a, b) => a - b), examId: examId || null })
  }
  const studyDays = 7 - off.length

  return (
    <form onSubmit={submit} noValidate className="space-y-5 rounded-2xl bg-raised p-4">
      <h3 className="font-display text-xl font-bold tracking-tight">{title}</h3>
      <div className="field"><span className={heading}>Working towards</span>
        <Dropdown label="Working towards" value={examId} onChange={setExamId}
          options={[{ value: '', label: 'No exam: keep going' }, ...exams.map(x => ({ value: x.id, label: x.title }))]} />
      </div>
      <fieldset>
        <legend className={heading}>Mode</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {MODES.map(m => (
            <label key={m.value} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 transition has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 sm:flex-col sm:gap-2">
              <input type="radio" name="mode" className="sr-only" checked={mode === m.value} onChange={() => setMode(m.value)} />
              <span aria-hidden className={`grid size-8 shrink-0 place-items-center rounded-lg ${mode === m.value ? 'bg-accent-solid text-white' : 'bg-surface text-muted'}`}><m.icon size={16} /></span>
              <span className="min-w-0"><span className="block text-[15px] font-semibold">{m.label}</span> <span className="mt-0.5 block text-[13px] leading-snug text-muted">{m.blurb}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <span className={heading}>Time each day</span>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map(p => (
            <button key={p} type="button" aria-pressed={minutes === String(p)} onClick={() => setMinutes(String(p))}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${minutes === String(p) ? 'bg-accent-solid text-white' : 'bg-surface text-fg'}`}>{p} min</button>
          ))}
          <label className="field ml-auto flex w-32 items-center gap-2"><span className="whitespace-nowrap text-sm text-muted">Minutes a day</span>
            <input type="number" min={10} max={240} step={5} value={minutes} onChange={e => setMinutes(e.target.value)} />
          </label>
        </div>
      </div>
      <fieldset>
        <legend className={heading}>Days off <span className="font-normal normal-case tracking-normal">· studying {studyDays} {studyDays === 1 ? 'day' : 'days'} a week</span></legend>
        <div className="flex flex-wrap gap-2">
          {DAYS.map(([n, label]) => (
            <label key={n} className={`cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 ${off.includes(n) ? 'bg-surface text-muted line-through' : 'bg-accent-soft text-accent'}`}>
              <input type="checkbox" className="sr-only" checked={off.includes(n)}
                onChange={e => setOff(o => (e.target.checked ? [...o, n] : o.filter(x => x !== n)))} />{label}
            </label>
          ))}
        </div>
      </fieldset>
      {(problem || error) && <p role="alert" className="text-sm text-danger">{problem ?? error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn !rounded-full" onClick={onCancel}>Cancel</button>
        <button className="btn-primary !rounded-full" disabled={saving}>{saving ? 'Saving…' : 'Save plan'}</button>
      </div>
    </form>
  )
}
