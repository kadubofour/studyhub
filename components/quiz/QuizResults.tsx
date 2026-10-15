'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Check, RotateCcw, Target, X } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { createCards } from '@/lib/data/cards'
import { DeckPicker, resolveDeck, type DeckChoice } from '@/components/ai/DeckPicker'
import { useToast } from '@/components/providers/ToastProvider'
import { BTN_OUTLINE, BTN_SOFT, BTN_SOLID } from '@/components/ui/buttonStyles'
import { MarkdownView } from '@/components/notes/MarkdownView'
import { answerText, missedQuestions, percent, ringDash, scoreLine } from '@/lib/quiz/summary'
import type { Quiz, QuizAttempt } from '@/lib/quiz/types'

const R = 52

// The score as a ring, how it went, every question looked back on, and what to do next
export function QuizResults({ quiz, attempt, previous, onRetake, onRetryMissed }: {
  quiz: Quiz; attempt: QuizAttempt; previous: QuizAttempt | null; onRetake: () => void; onRetryMissed?: () => Promise<void> | void
}) {
  const toast = useToast()
  const wrong = missedQuestions(quiz, attempt)
  const [picking, setPicking] = useState(false)
  const [deck, setDeck] = useState<DeckChoice>({ kind: 'new', name: quiz.title })
  const [busy, setBusy] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const diff = previous ? attempt.correct - previous.correct : 0
  const pct = percent(attempt.correct, attempt.total)
  const { circumference, offset } = ringDash(pct, R)
  const cards = wrong.map(q => ({
    front: q.prompt,
    back: `${answerText(q, q.answer)}. ${q.explanation}`.trim(),
  }))

  async function save() {
    setBusy(true)
    try {
      const sb = supabase()
      await createCards(sb, await resolveDeck(sb, deck), cards, { noteId: quiz.note_id })
      toast(`Saved ${cards.length} card${cards.length === 1 ? '' : 's'}.`); setPicking(false)
    } catch { toast('Couldn\'t save the cards.') } finally { setBusy(false) }
  }

  async function retry() {
    if (!onRetryMissed) return
    setRetrying(true)
    try { await onRetryMissed() } catch { toast('Couldn\'t start that quiz.'); setRetrying(false) }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 md:py-12">
      <section className="rounded-3xl border border-line bg-raised p-6 text-center shadow-sm md:p-8">
        <p className="text-sm text-muted">{quiz.title}</p>
        <div className="relative mx-auto mt-4 size-40">
          <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
            <circle cx="60" cy="60" r={R} fill="none" strokeWidth="10" className="stroke-line" />
            <circle cx="60" cy="60" r={R} fill="none" strokeWidth="10" strokeLinecap="round" className={pct >= 60 ? 'stroke-success' : pct >= 40 ? 'stroke-accent-solid' : 'stroke-danger'}
              strokeDasharray={circumference} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset .8s ease-out' }} />
          </svg>
          <div className="absolute inset-0 grid place-content-center">
            <span className="text-4xl font-bold leading-none">{attempt.correct} / {attempt.total}</span>
            <span className="mt-1 text-sm text-muted">{pct}%</span>
          </div>
        </div>
        <h1 className="mt-4 text-2xl font-semibold">{scoreLine(attempt.correct, attempt.total)}</h1>
        {previous && <p className="mt-1 text-sm text-muted">Last time {previous.correct}/{previous.total} · {diff > 0 ? `up ${diff}` : diff < 0 ? `down ${-diff}` : 'same'}</p>}

        <div className="mt-6 flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
          {wrong.length > 0 && onRetryMissed && (
            <button type="button" className={BTN_SOLID} disabled={retrying} onClick={retry}><Target size={16} aria-hidden />{retrying ? 'Starting…' : `Retake ${wrong.length} missed question${wrong.length === 1 ? '' : 's'}`}</button>
          )}
          {wrong.length > 0 && !picking && (
            <button type="button" className={wrong.length > 0 && onRetryMissed ? BTN_SOFT : BTN_SOLID} onClick={() => setPicking(true)}>Make cards from {wrong.length} wrong answer{wrong.length === 1 ? '' : 's'}</button>
          )}
          <button type="button" className={BTN_OUTLINE} onClick={onRetake}><RotateCcw size={15} aria-hidden />Retake</button>
          <Link href={`/notes/${quiz.note_id}`} className={BTN_OUTLINE}>Back to note</Link>
        </div>
        {picking && (
          <div className="mt-4 space-y-3 text-left">
            <DeckPicker value={deck} onChange={setDeck} />
            <button type="button" className={BTN_SOLID} disabled={busy} onClick={save}>Save {cards.length} card{cards.length === 1 ? '' : 's'}</button>
          </div>
        )}
      </section>

      <h2 className="mb-3 mt-8 text-sm font-semibold text-muted">Your answers</h2>
      <ol className="space-y-2.5">
        {quiz.questions.map((q, i) => {
          const a = attempt.answers[q.id]
          const ok = !!a?.correct
          return (
            <li key={q.id}>
              <details open={!ok} className={`group rounded-2xl border bg-raised ${ok ? 'border-line' : 'border-danger/40'}`}>
                <summary className="flex cursor-pointer list-none items-start gap-3 p-3.5 [&::-webkit-details-marker]:hidden">
                  <span aria-hidden className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-white ${ok ? 'bg-success' : 'bg-danger'}`}>{ok ? <Check size={14} /> : <X size={14} />}</span>
                  <span className="min-w-0 flex-1 text-sm font-medium"><span className="sr-only">{ok ? 'Correct. ' : 'Wrong. '}Question {i + 1}. </span><MarkdownView source={q.prompt} /></span>
                </summary>
                <div className="space-y-1.5 border-t border-line px-3.5 pb-3.5 pt-3 text-sm">
                  {!ok && <p><span className="text-muted">Your answer: </span>{a ? answerText(q, a.given) : 'No answer'}</p>}
                  <p><span className="text-muted">Answer: </span><span className="font-medium">{answerText(q, q.answer)}</span></p>
                  {a?.feedback && <p>{a.feedback}</p>}
                  {q.explanation && <p className="text-muted">{q.explanation}</p>}
                </div>
              </details>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
