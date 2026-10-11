'use client'
import { useState } from 'react'
import { CardFace } from '@/components/flashcards/CardFace'
import type { Question } from '@/lib/games/build'

type Props = { questions: Question[]; onDone: (r: { score: number; total: number }) => void }

// Speed round: a front, four backs, pick the right one. No clock.
export function SpeedGame({ questions, onDone }: Props) {
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const q = questions[i]
  const last = i === questions.length - 1
  const right = picked === q.answer

  function pick(o: string) {
    if (picked !== null) return
    setPicked(o)
    if (o === q.answer) setScore(s => s + 1)
  }
  function next() {
    if (last) { onDone({ score, total: questions.length }); return }
    setI(i + 1); setPicked(null)
  }

  return (
    <div>
      <p className="mb-2 text-sm text-muted">Question {i + 1} of {questions.length}</p>
      <div key={i} tabIndex={-1} autoFocus className="card mb-3 outline-none"><CardFace text={q.card.front} /></div>
      <div className="space-y-2">
        {q.options.map(o => (
          <button key={o} type="button" disabled={picked !== null} className={`card w-full text-left ${picked === o ? 'border-accent' : ''}`} onClick={() => pick(o)}>
            <CardFace text={o} />
          </button>
        ))}
      </div>
      <div className="mt-3">
        <div role="status">
          {picked !== null && (right ? <p className="text-sm font-medium text-success">Correct.</p> : <><p className="text-sm font-medium text-danger">Not quite. The answer is:</p><CardFace text={q.answer} /></>)}
        </div>
        {picked !== null && <button type="button" autoFocus className="btn-primary mt-2" onClick={next}>{last ? 'See results' : 'Next'}</button>}
      </div>
    </div>
  )
}
