import type { SupabaseClient } from '@supabase/supabase-js'
import type { Card } from '../types'
import { cardToState, schedule, stateToCardPatch, type Rating } from '../srs'
import { check, fetchAll, must } from './util'

const COLS = 'id,deck_id,front,back,due_at,interval_days,ease,reps,lapses'

export async function listCards(sb: SupabaseClient, deckId: string): Promise<Card[]> {
  return fetchAll<Card>((from, to) => sb.from('cards').select(COLS).eq('deck_id', deckId)
    .order('created_at').order('id').range(from, to))
}

export async function createCards(
  sb: SupabaseClient, deckId: string, cards: { front: string; back: string }[], opts?: { noteId?: string | null },
): Promise<Card[]> {
  if (!cards.length) return []
  const note = opts?.noteId ? { note_id: opts.noteId } : {}
  return must(await sb.from('cards').insert(cards.map(c => ({ ...c, deck_id: deckId, ...note }))).select(COLS))
}

export async function updateCard(sb: SupabaseClient, id: string, patch: { front?: string; back?: string }): Promise<void> {
  check(await sb.from('cards').update(patch).eq('id', id))
}

export async function deleteCard(sb: SupabaseClient, id: string): Promise<void> {
  check(await sb.from('cards').delete().eq('id', id))
}

export async function listDueCards(sb: SupabaseClient, now: Date, deckId?: string, limit = 200): Promise<Card[]> {
  let q = sb.from('cards').select(COLS).lte('due_at', now.toISOString()).order('due_at').limit(limit)
  if (deckId) q = q.eq('deck_id', deckId)
  return must(await q)
}

export async function countDueCards(sb: SupabaseClient, now: Date): Promise<number> {
  const { count, error } = await sb.from('cards').select('id', { count: 'exact', head: true }).lte('due_at', now.toISOString())
  if (error) throw error
  return count ?? 0
}

export async function rateCard(sb: SupabaseClient, card: Card, rating: Rating, now: Date): Promise<Card> {
  const next = schedule(cardToState(card), rating, now)
  const p = stateToCardPatch(next)
  // One transaction: the review row and the new schedule land together or not at all
  const updated: Card = must(await sb.rpc('rate_card', {
    p_card_id: card.id, p_due_at: p.due_at, p_interval_days: p.interval_days, p_ease: p.ease, p_reps: p.reps,
    p_lapses: p.lapses, p_rating: rating, p_reviewed_at: now.toISOString(), p_prev_interval_days: card.interval_days,
  }).select(COLS).single())
  return updated
}
