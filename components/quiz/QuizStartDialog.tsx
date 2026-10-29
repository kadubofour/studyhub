'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ListChecks, Search } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { ChoiceChips } from '@/components/ui/ChoiceChips'
import { BTN_OUTLINE, BTN_SOLID } from '@/components/ui/buttonStyles'
import { AiError } from '@/components/ai/AiError'
import { postAi } from '@/components/ai/aiFetch'
import { freeAllowanceText, usePlan } from '@/components/billing/usePlan'
import { focusRadio, radioKeyTarget } from '@/lib/ui/radioKeys'
import { supabase } from '@/lib/supabase/client'
import { listNotes } from '@/lib/data/notes'
import { listCourses } from '@/lib/data/courses'
import { listRecentQuizzes } from '@/lib/data/quizzes'
import type { Quiz, QuestionType } from '@/lib/quiz/types'
import type { Course, NoteSummary } from '@/lib/types'

const TYPES: [QuestionType, string][] = [['mcq', 'Multiple choice'], ['true_false', 'True or false'], ['short', 'Short answer']]
const COUNTS = [{ value: '5', label: '5' }, { value: '10', label: '10' }, { value: '15', label: '15' }]

// Quiz yourself from anywhere: pick a note, how many questions and which kinds, and start. Quizzes already made are listed to take again.
export function QuizStartDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Quiz yourself" icon={ListChecks} size="md" subtitle="Pick a note and Studyhub writes questions from it.">
      {open && <Body onClose={onClose} />}
    </Dialog>
  )
}

function Body({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const plan = usePlan()
  const [notes, setNotes] = useState<NoteSummary[] | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [past, setPast] = useState<Awaited<ReturnType<typeof listRecentQuizzes>>>([])
  const [query, setQuery] = useState('')
  const [noteId, setNoteId] = useState<string | null>(null)
  const [count, setCount] = useState('10')
  const [types, setTypes] = useState<QuestionType[]>(['mcq', 'true_false', 'short'])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ code: string; message: string } | null>(null)
  // Closing the dialog stops a quiz that is still being written, so the student is not taken to it later
  const request = useRef<AbortController | null>(null)
  const starting = useRef(false) // set at once, so two clicks in the same instant start one quiz
  useEffect(() => () => request.current?.abort(), [])

  useEffect(() => {
    let live = true
    const sb = supabase()
    listNotes(sb).then(n => { if (live) setNotes(n) }).catch(() => { if (live) setNotes([]) })
    listCourses(sb).then(c => { if (live) setCourses(c) }).catch(() => {})
    listRecentQuizzes(sb, 5).then(p => { if (live) setPast(p) }).catch(() => {})
    return () => { live = false }
  }, [])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (notes ?? []).filter(n => !q || (n.title || 'Untitled').toLowerCase().includes(q)).slice(0, 30)
  }, [notes, query])
  const courseOf = (id: string | null) => courses.find(c => c.id === id)
  // A chosen note the search has hidden is not chosen any more: Start must not quiz something that cannot be seen
  const chosen = noteId && shown.some(n => n.id === noteId) ? noteId : null
  const hiddenCount = (notes?.length ?? 0) - shown.length

  async function start() {
    if (!chosen || starting.current) return
    starting.current = true
    const controller = new AbortController()
    request.current = controller
    setBusy(true); setError(null)
    try {
      const r = await postAi<Quiz>('/api/ai/quiz', { noteId: chosen, count: Number(count), types }, controller.signal)
      if (controller.signal.aborted) return
      starting.current = false
      setBusy(false)
      if (r.ok) { onClose(); router.push(`/quiz/${r.value.id}`) }
      else setError({ code: r.error, message: r.message })
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return // closed meanwhile
      starting.current = false
      setBusy(false); setError({ code: 'ai_failed', message: 'Couldn\'t reach the AI. Try again.' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-medium">Which note?</p>
        {notes && notes.length > 6 && (
          <label className="flex items-center gap-2 rounded-xl border border-line bg-raised px-3 py-2 text-sm">
            <Search size={15} className="text-muted" aria-hidden />
            <input aria-label="Search notes" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search your notes" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted" />
          </label>
        )}
        {notes === null ? <p className="rounded-xl bg-surface px-4 py-6 text-center text-sm text-muted" role="status">Loading your notes…</p>
          : notes.length === 0 ? <p className="rounded-xl bg-surface px-4 py-6 text-center text-sm text-muted">You have no notes yet. <Link href="/notes" onClick={onClose} className="text-accent underline">Write one</Link>, then quiz yourself on it.</p>
          : shown.length === 0 ? <p className="rounded-xl bg-surface px-4 py-6 text-center text-sm text-muted">No note matches “{query}”.</p>
          : (
            <div role="radiogroup" aria-label="Note" className="max-h-56 space-y-1.5 overflow-y-auto rounded-xl">
              {shown.map((n, i) => {
                const c = courseOf(n.course_id)
                const on = chosen === n.id
                const tab = on || (!chosen && i === 0)
                return (
                  <button key={n.id} type="button" role="radio" aria-checked={on} tabIndex={tab ? 0 : -1}
                    onClick={() => { setNoteId(n.id); setError(null) }}
                    onKeyDown={e => {
                      const to = radioKeyTarget(e.key, i, shown.length)
                      if (to === null) return
                      e.preventDefault(); setNoteId(shown[to].id); setError(null); focusRadio(e.currentTarget, to)
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition ${on ? 'border-accent bg-accent-soft' : 'border-line bg-raised hover:bg-surface'}`}>
                    <span aria-hidden className={`grid size-4 shrink-0 place-items-center rounded-full border-2 ${on ? 'border-accent' : 'border-line'}`}>{on && <span className="size-2 rounded-full bg-accent-solid" />}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{n.title || 'Untitled'}</span>
                    {c && <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted"><span aria-hidden className="size-2 rounded-[3px]" style={{ background: c.color }} />{c.name}</span>}
                  </button>
                )
              })}
            </div>
          )}
        {hiddenCount > 0 && !query.trim() && <p className="text-xs text-muted">Showing your {shown.length} latest notes. Search to find the others.</p>}
      </div>

      <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Questions</p>
          <ChoiceChips label="Questions" value={count} onChange={setCount} options={COUNTS} />
        </div>
        <div className="min-w-0 space-y-1.5">
          <p className="text-sm font-medium">Kinds of question</p>
          <div role="group" aria-label="Question types" className="flex flex-wrap gap-1.5">
            {TYPES.map(([t, label]) => {
              const on = types.includes(t)
              return (
                <button key={t} type="button" aria-pressed={on} onClick={() => setTypes(ts => (on ? ts.filter(x => x !== t) : [...ts, t]))}
                  className={`choice rounded-lg px-3 py-1.5 text-sm transition pointer-coarse:py-2.5 ${on ? 'bg-accent-soft font-medium text-accent' : 'bg-surface text-muted hover:text-fg'}`}>{label}</button>
              )
            })}
          </div>
        </div>
      </div>

      {error && <AiError code={error.code} message={error.message} />}

      {past.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Your quizzes</p>
            <Link href="/quiz" onClick={onClose} className="text-sm font-medium text-accent">All quizzes and scores</Link>
          </div>
          <ul className="divide-y divide-line rounded-xl border border-line bg-raised text-sm">
            {past.map(({ quiz, best, attempts }) => (
              <li key={quiz.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <span className="min-w-0 truncate"><span className="font-medium">{quiz.title}</span><span className="text-muted"> · {quiz.questions.length} Qs{best ? ` · best ${best.correct}/${best.total}` : attempts ? '' : ' · not taken'}</span></span>
                <Link href={`/quiz/${quiz.id}`} onClick={onClose} className="shrink-0 font-medium text-accent">{attempts ? 'Retake' : 'Take'}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <DialogFooter note={plan.billing && !plan.loading && !plan.isPremium ? freeAllowanceText(plan.usedToday) : undefined}>
        <button type="button" className={BTN_OUTLINE} onClick={onClose}>Cancel</button>
        <button type="button" className={BTN_SOLID} disabled={!chosen || !types.length || busy} onClick={start}>{busy ? 'Writing quiz…' : '✦ Start quiz'}</button>
      </DialogFooter>
    </div>
  )
}
