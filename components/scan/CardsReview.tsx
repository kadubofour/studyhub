'use client'
import { DialogFooter } from '@/components/ui/Dialog'
import { BTN_OUTLINE, BTN_SOLID } from '@/components/ui/buttonStyles'
import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { createCards } from '@/lib/data/cards'
import { CardReviewList, keptCards, type ReviewCard } from '@/components/ai/CardReviewList'
import { DeckPicker, resolveDeck, type DeckChoice } from '@/components/ai/DeckPicker'
import type { ScanCardsResult } from '@/lib/ai/scan'

// Scanned flashcards: edit or untick any, pick a deck, save
export function CardsReview({ result, deckName, onSaved, onScanAgain }: {
  result: ScanCardsResult; deckName: string; onSaved: (count: number) => void; onScanAgain: () => void
}) {
  const [cards, setCards] = useState<ReviewCard[]>(() => result.cards.map(c => ({ ...c, keep: true })))
  const [deck, setDeck] = useState<DeckChoice>({ kind: 'new', name: deckName })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const savingRef = useRef(false)
  const madeDeck = useRef<string | null>(null)
  const keep = keptCards(cards)

  async function save() {
    if (savingRef.current || !keep.length) return
    savingRef.current = true; setSaving(true); setError(null)
    try {
      const sb = supabase()
      // A deck made by an earlier attempt that failed is reused, so a retry doesn't make a second one
      madeDeck.current ??= await resolveDeck(sb, deck)
      await createCards(sb, madeDeck.current, keep)
      onSaved(keep.length)
    } catch {
      setError('Couldn\'t save the cards. Try again.')
    } finally {
      savingRef.current = false; setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="rounded-lg bg-surface px-3 py-2 text-sm">{cards.length} cards found. Edit or untick any before saving.</p>
      <CardReviewList cards={cards} onChange={setCards} />
      <DeckPicker value={deck} onChange={choice => { madeDeck.current = null; setDeck(choice) }} />
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <DialogFooter>
        <button type="button" className={`${BTN_OUTLINE} mr-auto`} onClick={onScanAgain}>↺ Scan again</button>
        <button type="button" className={BTN_SOLID} disabled={saving || !keep.length} onClick={save}>Save {keep.length} card{keep.length === 1 ? '' : 's'}</button>
      </DialogFooter>
    </div>
  )
}
