'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { CardFace } from '@/components/flashcards/CardFace'
import { useSaver, useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { createCards, deleteCard, listCards, updateCard } from '@/lib/data/cards'
import { deleteDeck, getDeck } from '@/lib/data/decks'
import type { Card, Deck } from '@/lib/types'

export default function DeckPage() {
  const { deck: deckId } = useParams<{ deck: string }>()
  const router = useRouter()
  const save = useSaver()
  const toast = useToast()
  const [deck, setDeck] = useState<Deck | null>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  // "Due" is judged as of the last load/add (render must stay pure, so the clock is read in handlers)
  const [asOf, setAsOf] = useState(() => Date.now())

  useEffect(() => {
    const sb = supabase()
    Promise.all([getDeck(sb, deckId), listCards(sb, deckId)]).then(([d, cs]) => {
      setDeck(d); setCards(cs); setAsOf(Date.now())
    }).catch(() => router.replace('/flashcards')) // deleted or someone else's deck
  }, [deckId, router])

  async function add(e?: React.FormEvent) {
    e?.preventDefault()
    if (!front.trim() || !back.trim()) return
    const card = { front: front.trim(), back: back.trim() }
    // Clear right away so the next card can be typed while this one saves
    setFront(''); setBack('')
    document.getElementById('front')?.focus()
    try {
      const [c] = await createCards(supabase(), deckId, [card])
      setCards(cs => [...cs, c]); setAsOf(Date.now())
    } catch {
      // Give the text back unless the student has already started the next card
      setFront(f => f || card.front); setBack(b => b || card.back)
      toast('Couldn\'t save.')
    }
  }

  function saveEdit(card: Card, patch: { front: string; back: string }) {
    setEditing(null)
    save(
      () => setCards(cs => cs.map(c => (c.id === card.id ? { ...c, ...patch } : c))),
      () => setCards(cs => cs.map(c => (c.id === card.id ? card : c))),
      () => updateCard(supabase(), card.id, patch),
    )
  }

  function remove(card: Card) {
    save(
      () => setCards(cs => cs.filter(c => c.id !== card.id)),
      () => setCards(cs => [...cs, card]),
      () => deleteCard(supabase(), card.id),
    )
  }

  async function removeDeck() {
    if (!confirm(`Delete “${deck?.name}” and its ${cards.length} cards?`)) return
    try { await deleteDeck(supabase(), deckId); router.replace('/flashcards') } catch { toast('Couldn\'t delete the deck.') }
  }

  const due = cards.filter(c => new Date(c.due_at).getTime() <= asOf).length

  return (
    <div>
      <PageHeader title={deck?.name ?? 'Deck'} actions={<>
        {due > 0 && <Link href={`/review?deck=${deckId}`} className="btn-primary">Review {due}</Link>}
        <button className="btn-ghost text-danger" onClick={removeDeck}>Delete deck</button>
      </>} />
      <form onSubmit={add} className="card mb-4 grid gap-2 sm:grid-cols-2"
        onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) add() }}>
        <label className="field"><span>Front</span><textarea id="front" rows={2} value={front} onChange={e => setFront(e.target.value)} placeholder="What is the main function of mitochondria?" /></label>
        <label className="field"><span>Back</span><textarea rows={2} value={back} onChange={e => setBack(e.target.value)} placeholder="Produce ATP through cellular respiration" /></label>
        <div className="flex items-center justify-between sm:col-span-2">
          <span className="text-xs text-muted">Math works: $x^2$ · Ctrl+Enter to add</span>
          <button className="btn" disabled={!front.trim() || !back.trim()}>Add card</button>
        </div>
      </form>
      {cards.length === 0 && <p className="text-sm text-muted">Add your first card above.</p>}
      <div className="divide-y divide-line">
        {cards.map(c => editing === c.id ? (
          <EditRow key={c.id} card={c} onSave={p => saveEdit(c, p)} onCancel={() => setEditing(null)} />
        ) : (
          <div key={c.id} className="group grid grid-cols-[1fr_1fr_auto] gap-3 py-2 text-sm">
            <button className="text-left" onClick={() => setEditing(c.id)}><CardFace text={c.front} /></button>
            <button className="text-left text-muted" onClick={() => setEditing(c.id)}><CardFace text={c.back} /></button>
            <button aria-label="Delete card" className="btn-ghost opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => remove(c)}><Trash2 size={14} aria-hidden /></button>
          </div>
        ))}
      </div>
    </div>
  )
}

function EditRow({ card, onSave, onCancel }: { card: Card; onSave: (p: { front: string; back: string }) => void; onCancel: () => void }) {
  const [front, setFront] = useState(card.front)
  const [back, setBack] = useState(card.back)
  return (
    <div className="grid gap-2 py-2 sm:grid-cols-2">
      <textarea className="input" rows={2} value={front} onChange={e => setFront(e.target.value)} aria-label="Front" />
      <textarea className="input" rows={2} value={back} onChange={e => setBack(e.target.value)} aria-label="Back" />
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button className="btn" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" disabled={!front.trim() || !back.trim()} onClick={() => onSave({ front: front.trim(), back: back.trim() })}>Save</button>
      </div>
    </div>
  )
}
