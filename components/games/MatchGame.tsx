'use client'
import { useEffect, useRef, useState } from 'react'
import { CardFace } from '@/components/flashcards/CardFace'
import { shuffle, type GCard } from '@/lib/games/build'

type Props = { cards: GCard[]; onDone: (r: { score: number; total: number }) => void }

// Match: tap a term, then its meaning. A pair only counts for the score if its term was never matched wrongly.
export function MatchGame({ cards, onDone }: Props) {
  const [terms] = useState(() => shuffle(cards))
  const [meanings] = useState(() => shuffle(cards))
  const [term, setTerm] = useState<string | null>(null)
  const [matched, setMatched] = useState<Set<string>>(new Set())
  const [missed, setMissed] = useState<Set<string>>(new Set())
  const [wrong, setWrong] = useState(false)
  const [said, setSaid] = useState('')
  const termsRef = useRef<HTMLDivElement>(null)

  // After a pair, keyboard focus goes to the next free term instead of being lost with the disabled button
  useEffect(() => { if (matched.size) termsRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus() }, [matched])

  function pickMeaning(id: string) {
    if (!term) return
    if (term === id) {
      const next = new Set(matched).add(id)
      setMatched(next); setTerm(null); setWrong(false); setSaid(`Matched: ${cards.find(c => c.id === id)?.front ?? ''}`)
      if (next.size === cards.length) onDone({ score: cards.filter(c => !missed.has(c.id)).length, total: cards.length })
    } else {
      setMissed(new Set(missed).add(term)); setTerm(null); setWrong(true); setSaid('')
    }
  }

  return (
    <div>
      <p className="mb-3 text-sm text-muted" role="status">{wrong ? 'Not a match' : term ? 'Now pick its meaning' : said || 'Pick a term, then its meaning'}</p>
      <div className="grid grid-cols-2 gap-3">
        <div ref={termsRef} role="group" aria-label="Terms" className="space-y-2">
          {terms.map(c => (
            <button key={c.id} type="button" disabled={matched.has(c.id)} aria-pressed={term === c.id}
              className={`card w-full text-left ${term === c.id ? 'border-accent' : ''}`}
              onClick={() => { setTerm(c.id); setWrong(false); setSaid('') }}>
              <CardFace text={c.front} />
              {matched.has(c.id) && <span className="text-xs font-medium text-success">Matched</span>}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Meanings" className="space-y-2">
          {meanings.map(c => (
            <button key={c.id} type="button" disabled={matched.has(c.id)} className="card w-full text-left" onClick={() => pickMeaning(c.id)}>
              <CardFace text={c.back} />
              {matched.has(c.id) && <span className="text-xs font-medium text-success">Matched</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
