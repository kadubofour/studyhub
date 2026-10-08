'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { createCards } from '@/lib/data/cards'
import { postAi } from '@/components/ai/aiFetch'
import { AiError } from '@/components/ai/AiError'
import { CardReviewList, keptCards, type ReviewCard } from '@/components/ai/CardReviewList'
import { DeckPicker, resolveDeck, type DeckChoice } from '@/components/ai/DeckPicker'
import { useToast } from '@/components/providers/ToastProvider'

export function CardsTab({ note, prepare }: { note: { id: string; title: string }; prepare: () => Promise<void> }) {
  const toast = useToast()
  const [cards, setCards] = useState<ReviewCard[] | null>(null)
  const [deck, setDeck] = useState<DeckChoice>({ kind: 'new', name: note.title || 'New deck' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ code: string; message: string } | null>(null)
  const keep = cards ? keptCards(cards) : []

  async function generate() {
    setBusy(true); setError(null)
    await prepare()
    const r = await postAi<{ cards: { front: string; back: string }[] }>('/api/ai/flashcards', { noteId: note.id })
    setBusy(false)
    if (r.ok) setCards(r.value.cards.map(c => ({ ...c, keep: true })))
    else setError({ code: r.error, message: r.message })
  }

  async function save() {
    setBusy(true); setError(null)
    try {
      const sb = supabase()
      const deckId = await resolveDeck(sb, deck)
      await createCards(sb, deckId, keep, { noteId: note.id })
      toast(`Saved ${keep.length} card${keep.length === 1 ? '' : 's'}.`)
      setCards(null)
    } catch { setError({ code: 'save', message: 'Couldn\'t save the cards. Try again.' }) } finally { setBusy(false) }
  }

  if (!cards) return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Turn this note into flashcards. You&apos;ll check them before they&apos;re saved.</p>
      <button type="button" className="btn-primary" disabled={busy} onClick={generate}>{busy ? 'Making cards…' : '✦ Make flashcards'}</button>
      {error && <AiError code={error.code} message={error.message} />}
    </div>
  )
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{cards.length} cards found. Edit or untick any before saving.</p>
      <CardReviewList cards={cards} onChange={setCards} />
      <DeckPicker value={deck} onChange={setDeck} />
      {error && <AiError code={error.code} message={error.message} />}
      <div className="flex justify-between gap-2">
        <button type="button" className="btn" onClick={() => setCards(null)}>Discard</button>
        <button type="button" className="btn-primary" disabled={busy || !keep.length} onClick={save}>Save {keep.length} card{keep.length === 1 ? '' : 's'}</button>
      </div>
    </div>
  )
}
