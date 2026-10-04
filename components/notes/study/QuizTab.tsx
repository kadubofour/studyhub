'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { listQuizSummaries } from '@/lib/data/quizzes'
import { postAi } from '@/components/ai/aiFetch'
import { AiError } from '@/components/ai/AiError'
import type { Quiz, QuestionType } from '@/lib/quiz/types'

const TYPES: [QuestionType, string][] = [['mcq', 'Multiple choice'], ['true_false', 'True/false'], ['short', 'Short answer']]

export function QuizTab({ note, prepare }: { note: { id: string }; prepare: () => Promise<void> }) {
  const router = useRouter()
  const [count, setCount] = useState(10)
  const [types, setTypes] = useState<QuestionType[]>(['mcq', 'true_false', 'short'])
  const [past, setPast] = useState<Awaited<ReturnType<typeof listQuizSummaries>>>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ code: string; message: string } | null>(null)

  useEffect(() => { listQuizSummaries(supabase(), note.id).then(setPast).catch(() => {}) }, [note.id])

  async function create() {
    setBusy(true); setError(null)
    await prepare()
    const r = await postAi<Quiz>('/api/ai/quiz', { noteId: note.id, count, types })
    setBusy(false)
    if (r.ok) router.push(`/quiz/${r.value.id}`)
    else setError({ code: r.error, message: r.message })
  }

  return (
    <div className="space-y-3">
      <label className="field"><span>Questions</span>
        <select value={count} onChange={e => setCount(Number(e.target.value))}>{[5, 10, 15].map(n => <option key={n} value={n}>{n}</option>)}</select>
      </label>
      <fieldset className="space-y-1 text-sm"><legend className="mb-1 text-muted">Question types</legend>
        {TYPES.map(([t, label]) => (
          <label key={t} className="flex items-center gap-2">
            <input type="checkbox" checked={types.includes(t)} onChange={e => setTypes(ts => (e.target.checked ? [...ts, t] : ts.filter(x => x !== t)))} />{label}
          </label>
        ))}
      </fieldset>
      <button type="button" className="btn-primary" disabled={busy || !types.length} onClick={create}>{busy ? 'Writing quiz…' : '✦ New quiz'}</button>
      {error && <AiError code={error.code} message={error.message} />}
      {past.length > 0 && (
        <div className="pt-2">
          <h3 className="section-label">Past quizzes</h3>
          <ul className="space-y-1 text-sm">
            {past.map(({ quiz, best, attempts }) => (
              <li key={quiz.id} className="flex items-center justify-between gap-2">
                <span className="truncate">{quiz.title} · {quiz.questions.length} Qs{best ? ` · best ${best.correct}/${best.total}` : attempts ? '' : ' · not taken'}</span>
                <Link href={`/quiz/${quiz.id}`} className="text-accent">{attempts ? 'Retake' : 'Take'}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
