'use client'
import { useEffect, useRef, useState } from 'react'
import { Check, Loader2, Minus, Plus, X } from 'lucide-react'
import { Switch } from '@/components/ui/Switch'
import { Working } from '@/components/ui/Working'
import { postAi } from '@/components/ai/aiFetch'
import { supabase } from '@/lib/supabase/client'
import { COURSE_COLORS } from '@/lib/colors'
import { createCourse } from '@/lib/data/courses'
import { saveStarterMaterial } from '@/lib/setup/starter'
import type { StarterTopic } from '@/lib/ai/programme'
import type { About } from '@/components/setup/AboutFields'

type Phase = 'finding' | 'choose' | 'working' | 'done'
type Row = { name: string; state: 'waiting' | 'working' | 'done' | 'plain' | 'failed'; note?: string }
const STOPS = ['daily_limit', 'fair_use', 'ai_unavailable'] // once one of these comes back the AI is not asked again

// The courses of a programme, suggested by the AI, for the student to tick, add their own to, and have added to their account,
// with an option for the AI to write a starter set of topics, each with a note, for every course. existing: the courses already there.
export function ProgrammeSetup({ about, existing, onDone }: { about: About; existing: string[]; onDone: (added: number) => void }) {
  const [phase, setPhase] = useState<Phase>('finding')
  const [names, setNames] = useState<string[]>([])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [extra, setExtra] = useState('')
  const [material, setMaterial] = useState(true)
  const [problem, setProblem] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [added, setAdded] = useState(0)
  const started = useRef(false)
  const have = new Set(existing.map(e => e.toLowerCase()))

  async function find() {
    setPhase('finding'); setProblem(null)
    const r = await postAi<{ courses: string[] }>('/api/ai/programme-courses', { programme: about.programme, school: about.school, year: about.year })
    if (!r.ok) { setProblem(r.message); setNames([]); setPicked(new Set()); setPhase('choose'); return }
    const fresh = r.value.courses.filter(c => !have.has(c.toLowerCase()))
    setNames(fresh); setPicked(new Set(fresh)); setPhase('choose')
  }
  useEffect(() => { if (!started.current) { started.current = true; void find() } }) // once: asking costs an AI action

  function addOwn(e: React.FormEvent) {
    e.preventDefault()
    const n = extra.replace(/\s+/g, ' ').trim().slice(0, 80)
    if (!n || have.has(n.toLowerCase()) || names.some(x => x.toLowerCase() === n.toLowerCase())) { setExtra(''); return }
    setNames(l => [...l, n]); setPicked(p => new Set(p).add(n)); setExtra('')
  }
  const toggle = (n: string) => setPicked(p => { const s = new Set(p); if (s.has(n)) s.delete(n); else s.add(n); return s })

  async function run() {
    const chosen = names.filter(n => picked.has(n))
    setRows(chosen.map(name => ({ name, state: 'waiting' }))); setPhase('working')
    const patch = (i: number, row: Partial<Row>) => setRows(rs => rs.map((r, j) => (j === i ? { ...r, ...row } : r)))
    const sb = supabase()
    let ai = material, made = 0
    for (const [i, name] of chosen.entries()) {
      patch(i, { state: 'working' })
      let courseId: string
      try { courseId = (await createCourse(sb, { name, color: COURSE_COLORS[(existing.length + made) % COURSE_COLORS.length] })).id; made++ } catch { patch(i, { state: 'failed', note: "Couldn't add it" }); continue }
      if (!ai) { patch(i, { state: 'plain' }); continue }
      const r = await postAi<{ topics: StarterTopic[] }>('/api/ai/starter-material', { course: name, programme: about.programme, school: about.school, year: about.year })
      if (!r.ok) { if (STOPS.includes(r.error)) ai = false; patch(i, { state: 'plain', note: r.message }); continue }
      try { const n = await saveStarterMaterial(sb, courseId, r.value.topics); patch(i, { state: 'done', note: `${n} topics with notes` }) } catch { patch(i, { state: 'plain', note: "Couldn't save the notes" }) }
    }
    setAdded(made); setPhase('done')
  }

  if (phase === 'finding') return <Working kind="think" label="Finding your courses" steps={[`Looking up ${about.programme}`, 'Picking the usual courses', 'Putting them in order']} />

  if (phase === 'working' || phase === 'done') return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{phase === 'done' ? (added === 0 ? 'Nothing was added' : `${added} ${added === 1 ? 'course' : 'courses'} added`) : 'Setting up your courses'}</h2>
      <ul aria-label="Your courses" className="divide-y divide-line overflow-hidden rounded-2xl bg-raised">
        {rows.map(r => (
          <li key={r.name} className="flex items-start gap-3 px-4 py-3">
            <span aria-hidden className="mt-0.5 grid size-5 shrink-0 place-items-center">
              {r.state === 'working' ? <Loader2 size={17} className="animate-spin text-accent" />
                : r.state === 'done' ? <Check size={17} className="text-accent" />
                : r.state === 'failed' ? <X size={17} className="text-danger" />
                : r.state === 'plain' ? <Check size={17} className="text-muted" /> : <Minus size={17} className="text-muted" />}
            </span>
            <span className="min-w-0 flex-1"><span className="block text-[15px] font-medium">{r.name}</span>{r.note && <span className={`block text-[13px] ${r.state === 'failed' ? 'text-danger' : 'text-muted'}`}>{r.note}</span>}</span>
          </li>
        ))}
      </ul>
      {phase === 'done' && <>
        {rows.some(r => r.state === 'done') && <p className="text-[13px] text-muted">The notes are drafts written by the AI. Each says so at the top: check them against your lectures.</p>}
        <button type="button" className="btn-primary w-full" onClick={() => onDone(added)}>Continue</button>
      </>}
    </div>
  )

  const count = picked.size
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Your courses</h2>
        <p className="text-sm text-muted">{names.length ? `Suggested for ${about.programme}${about.year ? `, ${about.year}` : ''}. Untick any you don't take.` : 'Add the courses you take.'}</p>
      </div>
      {problem && <p role="alert" className="text-sm text-danger">{problem} <button type="button" className="underline" onClick={() => { void find() }}>Try again</button></p>}
      {names.length > 0 && (
        <ul aria-label="Suggested courses" className="divide-y divide-line overflow-hidden rounded-2xl bg-raised">
          {names.map(n => (
            <li key={n}>
              <label className="flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2.5 text-[15px] active:bg-surface">
                <input type="checkbox" className="size-5 shrink-0 accent-[var(--accent-solid)]" checked={picked.has(n)} onChange={() => toggle(n)} />{n}
              </label>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={addOwn} className="flex gap-2">
        <input aria-label="Add a course" className="input min-w-0 flex-1" value={extra} maxLength={80} onChange={e => setExtra(e.target.value)} placeholder="Add a course of your own" />
        <button className="btn" disabled={!extra.trim()}><Plus size={15} aria-hidden />Add</button>
      </form>
      <div className="flex items-start gap-3 rounded-2xl bg-accent-soft p-4">
        <span className="min-w-0 flex-1">
          <span id="starter-label" className="block text-[15px] font-semibold">Write starter notes with the AI</span>
          <span id="starter-hint" className="mt-0.5 block text-[13px] text-muted">For each course, the AI drafts its topics and a short note for each, so you start with something to revise. It uses 1 AI action per course, and the notes are drafts to check against your lectures.</span>
        </span>
        <Switch checked={material} onChange={setMaterial} labelledBy="starter-label" describedBy="starter-hint" />
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn-primary flex-1" disabled={count === 0} onClick={() => { void run() }}>{count === 0 ? 'Choose a course' : `Add ${count} ${count === 1 ? 'course' : 'courses'}`}</button>
        <button type="button" className="btn" onClick={() => onDone(0)}>Skip</button>
      </div>
    </div>
  )
}
