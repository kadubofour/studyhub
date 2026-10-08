'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { createCards } from '@/lib/data/cards'
import { DeckPicker, resolveDeck, type DeckChoice } from '@/components/ai/DeckPicker'
import { useToast } from '@/components/providers/ToastProvider'
import type { Quiz, QuizAttempt } from '@/lib/quiz/types'

export function QuizResults({ quiz, attempt, previous, onRetake }: { quiz: Quiz; attempt: QuizAttempt; previous: QuizAttempt | null; onRetake: () => void }) {
  const toast = useToast()
  const wrong = quiz.questions.filter(q => !attempt.answers[q.id]?.correct)
  const [picking, setPicking] = useState(false)
  const [deck, setDeck] = useState<DeckChoice>({ kind: 'new', name: quiz.title })
  const [busy, setBusy] = useState(false)
  const diff = previous ? attempt.correct - previous.correct : 0
  const cards = wrong.map(q => ({
    front: q.prompt,
    back: `${q.type === 'true_false' ? (q.answer === 'true' ? 'True' : 'False') : q.answer}. ${q.explanation}`.trim(),
  }))

  async function save() {
    setBusy(true)
    try {
      const sb = supabase()
      await createCards(sb, await resolveDeck(sb, deck), cards, { noteId: quiz.note_id })
      toast(`Saved ${cards.length} card${cards.length === 1 ? '' : 's'}.`); setPicking(false)
    } catch { toast('Couldn\'t save the cards.') } finally { setBusy(false) }
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-10 text-center">
      <p className="text-sm text-muted">{quiz.title}</p>
      <p className="mt-2 text-5xl font-bold">{attempt.correct} / {attempt.total}</p>
      {previous && <p className="mt-1 text-sm text-muted">Last time {previous.correct}/{previous.total} · {diff > 0 ? `up ${diff}` : diff < 0 ? `down ${-diff}` : 'same'}</p>}
      {wrong.length > 0 && (
        <ul className="mt-6 space-y-1 text-left text-sm">
          {wrong.map(q => <li key={q.id}>✗ {q.prompt}</li>)}
        </ul>
      )}
      {wrong.length > 0 && !picking && (
        <button type="button" className="btn-primary mt-4" onClick={() => setPicking(true)}>Make cards from {wrong.length} wrong answer{wrong.length === 1 ? '' : 's'}</button>
      )}
      {picking && (
        <div className="mt-4 space-y-3 text-left">
          <DeckPicker value={deck} onChange={setDeck} />
          <button type="button" className="btn-primary" disabled={busy} onClick={save}>Save {cards.length} card{cards.length === 1 ? '' : 's'}</button>
        </div>
      )}
      <div className="mt-6 flex justify-center gap-3 text-sm">
        <button type="button" className="btn" onClick={onRetake}>Retake</button>
        <Link href={`/notes/${quiz.note_id}`} className="btn">Back to note</Link>
      </div>
    </div>
  )
}
