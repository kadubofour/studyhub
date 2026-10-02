'use client'
import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CardFace } from '@/components/flashcards/CardFace'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { listDueCards, rateCard } from '@/lib/data/cards'
import { cardToState, previewIntervals, type Rating } from '@/lib/srs'
import { reviewKeyAction } from '@/lib/ui/reviewKeys'
import type { Card } from '@/lib/types'

const LABELS: Record<Rating, string> = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' }
const COLORS: Record<Rating, string> = { 1: 'text-danger', 2: 'text-amber-600', 3: 'text-accent', 4: 'text-green-600' }

function Review() {
  const deckId = useSearchParams().get('deck') ?? undefined
  const toast = useToast()
  const [queue, setQueue] = useState<Card[] | null>(null)
  const [initialCount, setInitialCount] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [stats, setStats] = useState({ reviewed: 0, again: 0 })
  // Synchronous guard (not state) so a second key press in the same tick sees it immediately
  const [busy] = useState(() => ({ current: false }))

  useEffect(() => {
    listDueCards(supabase(), new Date(), deckId).then(cs => { setQueue(cs); setInitialCount(cs.length) })
  }, [deckId])

  const card = queue?.[0]

  const rate = useCallback((rating: Rating) => {
    const attempt = async (): Promise<void> => {
      if (!card || busy.current) return
      busy.current = true
      try {
        const updated = await rateCard(supabase(), card, rating, new Date())
        setStats(s => ({ reviewed: s.reviewed + 1, again: s.again + (rating === 1 ? 1 : 0) }))
        // "Again" cards come back at the end of this session
        setQueue(q => (q ? [...q.slice(1), ...(rating === 1 ? [updated] : [])] : q))
        setRevealed(false)
      } catch {
        toast('Couldn\'t save.', { label: 'Retry', onClick: () => void attempt() })
      } finally {
        busy.current = false
      }
    }
    return attempt()
  }, [card, toast, busy])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof Element && e.target.closest('input, textarea')) return
      const action = reviewKeyAction(e, revealed, busy.current)
      if (!action) return
      e.preventDefault()
      if (action.type === 'reveal') setRevealed(true)
      else void rate(action.rating)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [revealed, rate, busy])

  if (!queue) return null

  if (!card) {
    return (
      <div className="mx-auto max-w-md py-12 text-center">
        <h1 className="mb-2 text-lg font-medium">{stats.reviewed ? 'Session complete' : 'Nothing due right now'}</h1>
        {stats.reviewed > 0 && <p className="mb-4 text-muted">{stats.reviewed} reviews · {stats.again} marked Again</p>}
        <Link href="/flashcards" className="btn">Back to decks</Link>
      </div>
    )
  }

  const preview = previewIntervals(cardToState(card), new Date())
  const done = Math.min(initialCount, stats.reviewed)

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-1 flex justify-between text-sm text-muted"><span>Review</span><span>{done} / {initialCount}</span></div>
      <div className="mb-6 h-1 rounded bg-surface"><div className="h-1 rounded bg-accent" style={{ width: `${initialCount ? (done / initialCount) * 100 : 0}%` }} /></div>
      <div className="card flex min-h-52 flex-col items-center justify-center gap-4 text-center">
        <CardFace text={card.front} />
        {revealed && <div className="w-full border-t border-line pt-4 text-accent"><CardFace text={card.back} /></div>}
      </div>
      <div className="mt-5 flex justify-center gap-2">
        {!revealed ? (
          <button className="btn min-w-48" onClick={() => setRevealed(true)}>Show answer <span className="text-muted">· space</span></button>
        ) : ([1, 2, 3, 4] as Rating[]).map(r => (
          <button key={r} className="btn min-w-20 flex-col gap-0" onClick={() => void rate(r)}>
            <span className={COLORS[r]}>{LABELS[r]}</span>
            <span className="text-[11px] text-muted">{preview[r]} · {r}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ReviewPage() {
  return <Suspense><Review /></Suspense>
}
