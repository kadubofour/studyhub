import type { SupabaseClient } from '@supabase/supabase-js'
import type { Deck, DeckWithDue } from '../types'
import { check, fetchAll, must } from './util'

export async function listDecksWithDue(sb: SupabaseClient, now: Date): Promise<DeckWithDue[]> {
  const decks: Deck[] = must(await sb.from('decks').select('id,course_id,name').order('created_at'))
  const cards = await fetchAll<{ deck_id: string; due_at: string }>((from, to) =>
    sb.from('cards').select('deck_id,due_at').order('id').range(from, to))
  const nowMs = now.getTime()
  return decks.map(d => {
    const mine = cards.filter(c => c.deck_id === d.id)
    return { ...d, total: mine.length, due: mine.filter(c => new Date(c.due_at).getTime() <= nowMs).length }
  })
}

export async function createDeck(sb: SupabaseClient, input: { name: string; course_id?: string | null }): Promise<Deck> {
  return must(await sb.from('decks').insert(input).select('id,course_id,name').single())
}

export async function updateDeck(sb: SupabaseClient, id: string, patch: Partial<Omit<Deck, 'id'>>): Promise<void> {
  check(await sb.from('decks').update(patch).eq('id', id))
}

export async function deleteDeck(sb: SupabaseClient, id: string): Promise<void> {
  check(await sb.from('decks').delete().eq('id', id))
}
