'use client'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CardFace } from '@/components/flashcards/CardFace'
import { TypedAnswer } from '@/components/flashcards/TypedAnswer'
import { ChoiceChips } from '@/components/ui/ChoiceChips'
import { EmptyState } from '@/components/ui/EmptyState'
import { Layers } from 'lucide-react'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { listDueCards, listPracticeCards, rateCard } from '@/lib/data/cards'
import { cardToState, previewIntervals, type Rating } from '@/lib/srs'
import { checkAnswer, type AnswerCheck } from '@/lib/ui/answerCheck'
import { reviewMode, useReviewMode } from '@/lib/ui/reviewMode'
import { reviewKeyAction } from '@/lib/ui/reviewKeys'
import { advanceQueue, RatingLedger } from '@/lib/ui/reviewQueue'
import type { Card } from '@/lib/types'

const LABELS: Record<Rating, string> = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' }
const VERDICT = { correct: { text: 'Correct', color: 'text-success' }, close: { text: 'Close', color: 'text-warn' }, different: { text: 'Not quite', color: 'text-danger' } } as const
const COLORS: Record<Rating, string> = { 1: 'text-danger', 2: 'text-warn', 3: 'text-accent', 4: 'text-success' }

function Review() {
  const params = useSearchParams()
  const deckId = params.get('deck') ?? undefined
  const practice = params.get('practice') === '1' // go over cards whether or not they are due: nothing is saved to the schedule
  const practiceHref = `/review?practice=1${deckId ? `&deck=${deckId}` : ''}`
  const toast = useToast()
  const [queue, setQueue] = useState<Card[] | null>(null)
  const [initialCount, setInitialCount] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const mode = useReviewMode()
  const ratings = useRef<HTMLDivElement>(null)
  const [typed, setTyped] = useState<{ text: string; check: AnswerCheck } | null>(null) // what was written for this card, and how it was marked
  const [stats, setStats] = useState({ reviewed: 0, again: 0 })
  // Synchronous guard (not state) so a second key press in the same tick sees it immediately
  const [busy] = useState(() => ({ current: false }))
  const [ledger] = useState(() => new RatingLedger())

  useEffect(() => {
    (practice ? listPracticeCards(supabase(), deckId) : listDueCards(supabase(), new Date(), deckId)).then(cs => { setQueue(cs); setInitialCount(cs.length) })
  }, [deckId, practice])

  // After Check (or "I don't know") the box is gone: land on the ratings, so Tab and a screen reader start there
  useEffect(() => { if (revealed && mode === 'type') ratings.current?.focus() }, [revealed, mode])

  const card = queue?.[0]
  // Taken when the card is shown (not when a key is pressed): a press that lands after this
  // card was rated but before the next card renders holds a stale ticket and is ignored.
  const shownTicket = useMemo(() => (card ? ledger.ticket(card.id) : 0), [card, ledger])

  const rate = useCallback((rating: Rating) => {
    if (!card) return Promise.resolve()
    const ticket = shownTicket
    const attempt = async (): Promise<void> => {
      // A Retry from an earlier failure is stale once this card was rated by a later press
      if (busy.current || !ledger.isCurrent(card.id, ticket)) return
      busy.current = true
      try {
        const updated = practice ? card : await rateCard(supabase(), card, rating, new Date())
        ledger.recorded(card.id)
        setStats(s => ({ reviewed: s.reviewed + 1, again: s.again + (rating === 1 ? 1 : 0) }))
        // "Again" cards come back at the end of this session
        setQueue(q => (q ? advanceQueue(q, card, updated, rating) : q))
        setRevealed(false); setTyped(null)
      } catch {
        toast('Couldn\'t save.', { label: 'Retry', onClick: () => void attempt() })
      } finally {
        busy.current = false
      }
    }
    return attempt()
  }, [card, shownTicket, toast, busy, ledger, practice])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof Element && e.target.closest('input, textarea')) return
      const action = reviewKeyAction(e, revealed, busy.current)
      if (!action) return
      if (action.type === 'reveal' && mode === 'type') return // typing mode reveals through Check
      e.preventDefault()
      if (action.type === 'reveal') setRevealed(true)
      else void rate(action.rating)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [revealed, rate, busy, mode])

  if (!queue) return null

  if (!card) {
    const title = practice ? (stats.reviewed ? 'Practice complete' : 'No cards to practise') : (stats.reviewed ? 'Session complete' : 'Nothing due right now')
    return (
      <div className="mx-auto max-w-md pt-6">
        <EmptyState icon={Layers} tone="a" title={title} level={1}
          body={stats.reviewed > 0 ? `${stats.reviewed} reviews${practice ? '' : ` · ${stats.again} marked Again`}` : practice ? 'This deck has no cards yet.' : 'Every card is up to date. Come back when some are due, or practise them now.'}>
          {practice
            ? stats.reviewed > 0 && <a href={practiceHref} className="btn-primary">Practise again</a> // a fresh load, so the cards are shuffled again
            : <Link href={practiceHref} className="btn-primary">Practise these cards</Link>}
          <Link href="/flashcards" className="btn">Back to decks</Link>
        </EmptyState>
      </div>
    )
  }

  const preview = previewIntervals(cardToState(card), new Date())
  const done = Math.min(initialCount, stats.reviewed)

  return (
    <div className="mx-auto max-w-lg">
      {practice && <p className="mb-3 rounded-lg bg-accent-soft px-3 py-2 text-center text-xs text-accent">Practice: your schedule won&apos;t change.</p>}
      <ChoiceChips label="Answer by" size="sm" className="mb-3" value={mode} onChange={v => reviewMode.set(v === 'type' ? 'type' : 'flip')}
        options={[{ value: 'flip', label: 'Flip' }, { value: 'type', label: 'Type answer' }]} />
      <div className="mb-1 flex justify-between text-sm text-muted"><span>Review</span><span>{done} / {initialCount}</span></div>
      <div className="mb-6 h-1 rounded bg-surface"><div className="h-1 rounded bg-accent" style={{ width: `${initialCount ? (done / initialCount) * 100 : 0}%` }} /></div>
      <div className="card flex min-h-52 flex-col items-center justify-center gap-4 text-center">
        <CardFace text={card.front} />
        {mode === 'type' && !revealed && (
          <TypedAnswer key={card.id} onCheck={t => { setTyped({ text: t, check: checkAnswer(t, card.back) }); setRevealed(true) }} onSkip={() => { setTyped(null); setRevealed(true) }} />
        )}
        {revealed && typed && (
          <div role="status" className="w-full space-y-1 border-t border-line pt-4 text-left">
            <p className={`text-sm font-medium ${VERDICT[typed.check.verdict].color}`}>{VERDICT[typed.check.verdict].text}</p>
            <p className="text-xs text-muted">Suggested: {LABELS[typed.check.suggested]}</p>
            <p className="text-xs text-muted">You wrote</p>
            <p className="whitespace-pre-wrap text-sm">{typed.text}</p>
          </div>
        )}
        {revealed && <div className="w-full border-t border-line pt-4 text-accent"><CardFace text={card.back} /></div>}
      </div>
      <div ref={ratings} tabIndex={revealed ? -1 : undefined} role={revealed ? 'group' : undefined} aria-label={revealed ? 'How well did you know it?' : undefined} className="mt-5 flex justify-center gap-2 outline-none">
        {!revealed ? (
          mode === 'type' ? null : <button className="btn min-w-48" onClick={() => setRevealed(true)}>Show answer <span className="text-muted">· space</span></button>
        ) : ([1, 2, 3, 4] as Rating[]).map(r => (
          <button key={r} className="btn min-w-20 flex-col gap-0" onClick={() => void rate(r)}>
            <span className={COLORS[r]}>{LABELS[r]}</span>
            <span className="text-[11px] text-muted">{practice ? r : `${preview[r]} · ${r}`}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ReviewPage() {
  return <Suspense><Review /></Suspense>
}
