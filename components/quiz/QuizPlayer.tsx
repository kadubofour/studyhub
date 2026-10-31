'use client'
import { useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { finishAttempt, saveAttempt } from '@/lib/data/quizzes'
import { markInstant, scoreOf } from '@/lib/quiz/marking'
import { answerText, optionLetter } from '@/lib/quiz/summary'
import { BTN_SOLID } from '@/components/ui/buttonStyles'
import type { AnswerRecord, Question, Quiz, QuizAttempt } from '@/lib/quiz/types'
import { MarkdownView } from '@/components/notes/MarkdownView'
import { Working } from '@/components/ui/Working'

const choicesOf = (q: Question) => (q.type === 'true_false' ? ['True', 'False'] : q.options ?? [])
const TYPE_LABEL = { mcq: 'Multiple choice', true_false: 'True or false', short: 'Short answer' } as const

export function QuizPlayer({ quiz, attempt, onFinished }: { quiz: Quiz; attempt: QuizAttempt; onFinished: (a: QuizAttempt) => void }) {
  const [answers, setAnswers] = useState<Record<string, AnswerRecord>>(attempt.answers)
  // Resume at the first unanswered question; if all are answered (refreshed before "See results"),
  // open the last one so finishing is one tap away
  const [index, setIndex] = useState(() => {
    const first = quiz.questions.findIndex(q => !attempt.answers[q.id])
    return first === -1 ? quiz.questions.length - 1 : first
  })
  const [typed, setTyped] = useState('')
  const [checking, setChecking] = useState(false)
  const [selfMark, setSelfMark] = useState<string | null>(null) // answer awaiting "I was right/wrong"
  const [error, setError] = useState<string | null>(null)
  const cardRef = useRef<HTMLElement>(null)
  const goOn = useRef<HTMLButtonElement>(null)
  const finishing = useRef(false)
  const q = quiz.questions[index]
  const done = answers[q.id]
  const last = index === quiz.questions.length - 1
  const rightSoFar = Object.values(answers).filter(a => a.correct).length

  // The answer shows straight away but saves in the background; leaving mid-save would lose it
  const [saving, setSaving] = useState(0)
  useEffect(() => {
    if (!saving) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [saving])

  async function record(rec: AnswerRecord) {
    const next = { ...answers, [q.id]: rec }
    setAnswers(next); setSelfMark(null)
    setSaving(n => n + 1)
    await saveAttempt(supabase(), attempt.id, next, scoreOf(next)).catch(() => setError('Couldn\'t save your answer. Check your connection.'))
    setSaving(n => n - 1)
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
    if (finishing.current) return
    finishing.current = true
    setError(null)
    try {
      onFinished(await finishAttempt(supabase(), attempt.id, answers, scoreOf(answers)))
    } catch {
      finishing.current = false
      setError('Couldn\'t finish the quiz. Check your connection and try again.')
    }
  }

  function next() { setTyped(''); setIndex(i => i + 1) }

  // Focus follows the quiz: onto the question when it appears, then onto the way on once it is answered, so a keyboard or screen reader
  // does not start again from the top of the page after every answer
  useEffect(() => { cardRef.current?.focus({ preventScroll: true }) }, [index])
  useEffect(() => { if (done) goOn.current?.focus({ preventScroll: true }) }, [done])

  // Keys: A to D (or 1 to 4) answer a choice question, Enter goes on once it is answered. Typing in the answer box is left alone.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement || e.target instanceof HTMLAnchorElement) return
      if (done) {
        if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); if (last) void finish(); else next() }
        return
      }
      if (q.type === 'short') return
      const i = '1234'.includes(e.key) && e.key !== '' ? Number(e.key) - 1 : 'abcd'.indexOf(e.key.toLowerCase())
      const choice = i >= 0 ? choicesOf(q)[i] : undefined
      if (choice) { e.preventDefault(); void choose(choice) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // the handlers read the current question and answers, so it is renewed whenever they change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, done, last, answers])

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 md:py-10">
      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="font-medium text-muted">Question {index + 1} of {quiz.questions.length}</p>
        <p className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent" aria-live="polite">
          <Check size={13} aria-hidden />{rightSoFar} correct
        </p>
      </div>
      <div role="progressbar" aria-label="Quiz progress" aria-valuemin={0} aria-valuemax={quiz.questions.length} aria-valuenow={Object.keys(answers).length}
        className="mt-3 flex gap-1">
        {quiz.questions.map((x, i) => {
          const a = answers[x.id]
          // a wrong answer is striped as well as red, so the difference does not rest on colour
        return <span key={x.id} className={`h-1.5 flex-1 rounded-full ${a ? (a.correct ? 'bg-success' : 'bg-danger') : i === index ? 'bg-accent-solid' : 'bg-line'}`}
          style={a && !a.correct ? { backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,.55) 0 2px, transparent 2px 5px)' } : undefined} />
        })}
      </div>

      <section ref={cardRef} tabIndex={-1} aria-label={`Question ${index + 1}`} className="mt-6 rounded-2xl border border-line bg-raised p-5 shadow-sm outline-none md:p-7">
        <span className="inline-block rounded-md bg-surface px-2 py-0.5 text-xs font-medium text-muted">{TYPE_LABEL[q.type]}</span>
        <div className="mt-3 text-xl font-semibold leading-snug md:text-2xl"><MarkdownView source={q.prompt} /></div>
      </section>

      {q.type !== 'short' && (
        <div className="mt-4 grid gap-2.5">
          {choicesOf(q).map((c, i) => {
            const value = q.type === 'true_false' ? c.toLowerCase() : c
            const isAnswer = value.toLowerCase() === q.answer.toLowerCase()
            const picked = done?.given === value
            const right = !!done && isAnswer
            const wrong = !!done && picked && !isAnswer
            return (
              <button key={c} type="button" disabled={!!done} onClick={() => choose(c)}
                className={`group flex w-full items-center gap-3 rounded-xl border-2 px-3.5 py-3 text-left text-base transition md:py-3.5 ${right ? 'border-success bg-success/10' : wrong ? 'border-danger bg-danger-soft' : done ? 'border-line opacity-60' : 'border-line bg-raised hover:border-accent hover:bg-accent-soft'}`}>
                <span aria-hidden className={`grid size-8 shrink-0 place-items-center rounded-lg text-sm font-semibold ${right ? 'bg-success text-white' : wrong ? 'bg-danger text-white' : 'bg-surface text-muted group-hover:bg-raised'}`}>
                  {right ? <Check size={16} /> : wrong ? <X size={16} /> : optionLetter(i)}
                </span>
                <span className="min-w-0 flex-1">{c}</span>
                {right && <span className="sr-only">Correct answer</span>}
                {wrong && <span className="sr-only">Your answer, not correct</span>}
              </button>
            )
          })}
          {!done && <p className="hidden text-center text-xs text-muted md:block">Press A to D to answer</p>}
        </div>
      )}

      {q.type === 'short' && !done && !selfMark && (
        <div className="mt-4 space-y-3">
          <label className="field"><span>Your answer</span>
            <textarea rows={4} value={typed} onChange={e => setTyped(e.target.value)} maxLength={1000} className="text-base" />
          </label>
          {checking
            ? <Working kind="check" size="sm" label="Checking your answer" className="text-sm text-muted" />
            : <button type="button" className={`${BTN_SOLID} w-full sm:w-auto`} disabled={!typed.trim()} onClick={check}>Check</button>}
        </div>
      )}

      {selfMark && (
        <div className="mt-4 rounded-xl bg-surface p-4 text-sm">
          <p>Couldn&apos;t mark this automatically. Expected: {q.answer}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn" onClick={() => record({ given: selfMark, correct: true, feedback: null })}>I was right</button>
            <button type="button" className="btn" onClick={() => record({ given: selfMark, correct: false, feedback: null })}>I was wrong</button>
          </div>
        </div>
      )}

      {done && (
        <div className={`mt-4 rounded-2xl border p-4 text-sm md:p-5 ${done.correct ? 'border-success/40 bg-success/10' : 'border-danger/40 bg-danger-soft'}`}>
          <p className="flex items-center gap-2 text-base font-semibold">
            {done.correct ? <Check size={18} className="text-success" aria-hidden /> : <X size={18} className="text-danger" aria-hidden />}
            {done.correct ? 'Correct.' : `Not quite. The answer is ${answerText(q, q.answer)}.`}
          </p>
          {done.feedback && <p className="mt-2">{done.feedback}</p>}
          {q.explanation && <p className="mt-2 text-muted">{q.explanation}</p>}
          <div className="mt-4 flex items-center justify-end gap-3">
            <span className="hidden text-xs text-muted md:inline">Press Enter</span>
            {last ? <button ref={goOn} type="button" className={`${BTN_SOLID} w-full sm:w-auto`} onClick={finish}>See results</button>
              : <button ref={goOn} type="button" className={`${BTN_SOLID} w-full sm:w-auto`} onClick={next}>Next</button>}
          </div>
        </div>
      )}
      {/* always on the page, so a screen reader announces the result as soon as it is marked */}
      <p role="status" className="sr-only">{done ? (done.correct ? 'Answer marked right.' : 'Answer marked wrong.') : ''}</p>
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
    </div>
  )
}
