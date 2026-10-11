'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { MatchGame } from '@/components/games/MatchGame'
import { SpeedGame } from '@/components/games/SpeedGame'
import { supabase } from '@/lib/supabase/client'
import { listCards } from '@/lib/data/cards'
import { getDeck } from '@/lib/data/decks'
import { recordGamePlay } from '@/lib/data/games'
import { buildMatch, buildSpeed, MIN_CARDS, type GCard, type Question } from '@/lib/games/build'
import type { Deck } from '@/lib/types'

type Round = { game: 'match'; cards: GCard[] } | { game: 'speed'; questions: Question[] } | { game: 'none'; why: string }

const TITLE = { match: 'Match', speed: 'Speed round' }

export default function PlayPage() {
  const { deck: deckId } = useParams<{ deck: string }>()
  const game = useSearchParams().get('game') === 'match' ? 'match' : 'speed'
  const router = useRouter()
  const [deck, setDeck] = useState<Deck | null>(null)
  const [all, setAll] = useState<GCard[] | null>(null)
  const [round, setRound] = useState<Round | null>(null)
  const [result, setResult] = useState<{ score: number; total: number } | null>(null)
  const [saveFailed, setSaveFailed] = useState(false)
  const [plays, setPlays] = useState(0) // changes with "Play again" so the game starts fresh

  function start(cards: GCard[]): Round {
    if (cards.length < MIN_CARDS) return { game: 'none', why: `A game needs at least ${MIN_CARDS} cards. Add a few more.` }
    if (game === 'match') {
      const picked = buildMatch(cards)
      return picked.length >= MIN_CARDS ? { game, cards: picked } : { game: 'none', why: 'This deck has too many cards with the same front or back to make pairs.' }
    }
    const questions = buildSpeed(cards)
    return questions.length >= MIN_CARDS ? { game, questions } : { game: 'none', why: 'This deck has too many cards with the same answer to make questions.' }
  }

  useEffect(() => {
    const sb = supabase()
    Promise.all([getDeck(sb, deckId), listCards(sb, deckId)])
      .then(([d, cs]) => { const gc = cs.map(c => ({ id: c.id, front: c.front, back: c.back })); setDeck(d); setAll(gc); setRound(start(gc)) })
      .catch(() => router.replace('/flashcards'))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- starts once per deck and game; "start" only reads the game
  }, [deckId, game, router])

  function again() { setRound(start(all ?? [])); setResult(null); setSaveFailed(false); setPlays(p => p + 1) }

  async function finish(r: { score: number; total: number }) {
    setResult(r)
    try { await recordGamePlay(supabase(), { deckId, game, ...r }) } catch { setSaveFailed(true) }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={`${TITLE[game]}${deck ? `: ${deck.name}` : ''}`} />
      {!round && <p className="text-sm text-muted">Loading…</p>}
      {round?.game === 'none' && <p className="card text-sm">{round.why}</p>}
      {round && !result && round.game === 'match' && <MatchGame key={plays} cards={round.cards} onDone={finish} />}
      {round && !result && round.game === 'speed' && <SpeedGame key={plays} questions={round.questions} onDone={finish} />}
      {result && (
        <div className="card text-center" role="status">
          <h2 tabIndex={-1} autoFocus className="text-lg font-medium outline-none">Score {result.score} / {result.total}</h2>
          <p className="mt-1 text-sm text-muted">Games do not change your card schedule.</p>
          {saveFailed && <p className="mt-2 text-sm text-danger">Could not save this play.</p>}
          <div className="mt-3 flex justify-center gap-2">
            <button className="btn-primary" onClick={again}>Play again</button>
            <Link className="btn" href={`/flashcards/${deckId}`}>Back to deck</Link>
          </div>
        </div>
      )}
      {round?.game === 'none' && <Link className="btn mt-3" href={`/flashcards/${deckId}`}>Back to deck</Link>}
    </div>
  )
}
