'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { postAi } from '@/components/ai/aiFetch'
import { supabase } from '@/lib/supabase/client'
import { createDeck } from '@/lib/data/decks'
import { createCards } from '@/lib/data/cards'

// Flashcards for a Learn session: made from the topic's newest note, or from an uploaded file when it has no note, kept in a deck for the course
// that the topic covers (so reviewing them counts towards the topic), then opened
export function useTopicCards() {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<{ code: string; message: string } | null>(null)
  async function start(s: { id: string; topic_id: string; topicName: string; noteId: string | null; materialId?: string | null }, courseId: string) {
    if (!s.noteId && !s.materialId) return
    setBusy(s.id); setError(null)
    const r = await postAi<{ cards: { front: string; back: string }[] }>('/api/ai/flashcards', s.noteId ? { noteId: s.noteId } : { materialId: s.materialId })
    if (!r.ok) { setBusy(null); setError({ code: r.error, message: r.message }); return }
    try {
      const sb = supabase()
      const deck = await createDeck(sb, { name: `${s.topicName} flashcards`.slice(0, 200), course_id: courseId })
      await createCards(sb, deck.id, r.value.cards, { noteId: s.noteId })
      // The deck covers the topic, so the cards' reviews show in how the topic is going
      const { error: linked } = await sb.from('topic_links').insert({ topic_id: s.topic_id, deck_id: deck.id })
      if (linked) throw linked
      router.push(`/flashcards/${deck.id}`)
    } catch {
      setError({ code: 'ai_failed', message: 'The flashcards were made but could not be saved. Try again.' })
    }
    setBusy(null)
  }
  return { busy, error, start }
}
