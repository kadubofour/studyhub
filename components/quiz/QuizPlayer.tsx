'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { finishAttempt, saveAttempt } from '@/lib/data/quizzes'
import { markInstant, scoreOf } from '@/lib/quiz/marking'
import type { AnswerRecord, Question, Quiz, QuizAttempt } from '@/lib/quiz/types'
import { MarkdownView } from '@/components/notes/MarkdownView'

const choicesOf = (q: Question) => (q.type === 'true_false' ? ['True', 'False'] : q.options ?? [])

export function QuizPlayer({ quiz, attempt, onFinished }: { quiz: Quiz; attempt: QuizAttempt; onFinished: (a: QuizAttempt) => void }) {
  const [answers, setAnswers] = useState<Record<string, AnswerRecord>>(attempt.answers)
  // Resume at the first question without an answer
  const [index, setIndex] = useState(() => Math.max(0, quiz.questions.findIndex(q => !attempt.answers[q.id])))
  const [typed, setTyped] = useState('')
  const [checking, setChecking] = useState(false)
  const [selfMark, setSelfMark] = useState<string | null>(null) // answer awaiting "I was right/wrong"
  const [error, setError] = useState<string | null>(null)
  const q = quiz.questions[index]
  const done = answers[q.id]
  const last = index === quiz.questions.length - 1

  async function record(rec: AnswerRecord) {
    const next = { ...answers, [q.id]: rec }
    setAnswers(next); setSelfMark(null)
    await saveAttempt(supabase(), attempt.id, next, scoreOf(next)).catch(() => setError('Couldn\'t save your answer. Check your connection.'))
  }

  async function choose(choice: string) {
    const given = q.type === 'true_false' ? choice.toLowerCase() : choice
    await record({ given, correct: markInstant(q, given) === true, feedback: null })
  }

  async function check() {
    const given = typed.trim()
    if (!given) return
    if (markInstant(q, given) === true) { await record({ given, correct: true, feedback: null }); return }
    setChecking(true); setError(null)
    try {
      const res = await fetch('/api/ai/quiz/mark', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ attemptId: attempt.id, questionId: q.id, answer: given }) })
      if (res.ok) { const m = await res.json() as { correct: boolean; feedback: string }; await record({ given, correct: m.correct, feedback: m.feedback }) }
      else setSelfMark(given)
    } catch { setSelfMark(given) } finally { setChecking(false) }
  }

  async function finish() {
    const a = await finishAttempt(supabase(), attempt.id, answers, scoreOf(answers))
    onFinished(a)
  }

  function next() { setTyped(''); setIndex(i => i + 1) }

  return (
    <div className="mx-auto max-w-xl px-5 py-8">
      <p className="text-sm text-muted">Question {index + 1} of {quiz.questions.length}</p>
      <div className="mt-2 h-1.5 rounded-full bg-surface"><div className="h-full rounded-full bg-accent-solid" style={{ width: `${(index / quiz.questions.length) * 100}%` }} /></div>
      <div className="mt-6 text-lg font-semibold"><MarkdownView source={q.prompt} /></div>

      {q.type !== 'short' && (
        <div className="mt-4 space-y-2">
          {choicesOf(q).map(c => {
            const value = q.type === 'true_false' ? c.toLowerCase() : c
            const isAnswer = value.toLowerCase() === q.answer.toLowerCase()
            const picked = done?.given === value
            return (
              <button key={c} type="button" disabled={!!done} onClick={() => choose(c)}
                className={`w-full rounded-xl border px-3 py-2 text-left ${done && isAnswer ? 'border-success bg-success/10' : picked ? 'border-danger bg-danger-soft' : 'border-line hover:bg-surface'}`}>{c}</button>
            )
          })}
        </div>
      )}

      {q.type === 'short' && !done && !selfMark && (
        <div className="mt-4 space-y-2">
          <label className="field"><span>Your answer</span>
            <textarea rows={3} value={typed} onChange={e => setTyped(e.target.value)} maxLength={1000} />
          </label>
          <button type="button" className="btn-primary" disabled={checking || !typed.trim()} onClick={check}>{checking ? 'Checking…' : 'Check'}</button>
        </div>
      )}

      {selfMark && (
        <div className="mt-4 rounded-xl bg-surface p-3 text-sm">
          <p>Couldn&apos;t mark this automatically. Expected: {q.answer}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" className="btn" onClick={() => record({ given: selfMark, correct: true, feedback: null })}>I was right</button>
            <button type="button" className="btn" onClick={() => record({ given: selfMark, correct: false, feedback: null })}>I was wrong</button>
          </div>
        </div>
      )}

      {done && (
        <div className="mt-4 rounded-xl bg-surface p-3 text-sm" aria-live="polite">
          <p className="font-medium">{done.correct ? 'Correct.' : `Not quite. The answer is ${q.type === 'true_false' ? (q.answer === 'true' ? 'True' : 'False') : q.answer}.`}</p>
          {done.feedback && <p className="mt-1">{done.feedback}</p>}
          <p className="mt-1 text-muted">{q.explanation}</p>
          <div className="mt-3 text-right">
            {last ? <button type="button" className="btn-primary" onClick={finish}>See results</button>
              : <button type="button" className="btn-primary" onClick={next}>Next</button>}
          </div>
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
    </div>
  )
}
