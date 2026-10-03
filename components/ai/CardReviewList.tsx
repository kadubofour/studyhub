'use client'
export type ReviewCard = { front: string; back: string; keep: boolean }

// AI-made cards to check before saving: edit either side, untick to leave one out
export function CardReviewList({ cards, onChange }: { cards: ReviewCard[]; onChange: (cards: ReviewCard[]) => void }) {
  const update = (i: number, patch: Partial<ReviewCard>) => onChange(cards.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  return (
    <ul className="space-y-2">
      {cards.map((c, i) => (
        <li key={i} className={`rounded-xl border border-line p-2 ${c.keep ? '' : 'opacity-50'}`}>
          <label className="mb-1 flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={c.keep} aria-label={`Keep card ${i + 1}`} onChange={e => update(i, { keep: e.target.checked })} />
            Card {i + 1}
          </label>
          <label className="field"><span className="sr-only">Front</span>
            <textarea aria-label="Front" rows={2} value={c.front} onChange={e => update(i, { front: e.target.value })} />
          </label>
          <label className="field mt-1"><span className="sr-only">Back</span>
            <textarea aria-label="Back" rows={2} value={c.back} onChange={e => update(i, { back: e.target.value })} />
          </label>
        </li>
      ))}
    </ul>
  )
}

export const keptCards = (cards: ReviewCard[]) =>
  cards.filter(c => c.keep && c.front.trim() && c.back.trim()).map(c => ({ front: c.front.trim(), back: c.back.trim() }))
