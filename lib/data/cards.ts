import type { SupabaseClient } from '@supabase/supabase-js'
import type { Card } from '../types'
import { cardToState, schedule, stateToCardPatch, type Rating } from '../srs'
import { check, must } from './util'

const COLS = 'id,deck_id,front,back,due_at,interval_days,ease,reps,lapses'

export async function listCards(sb: SupabaseClient, deckId: string): Promise<Card[]> {
  return must(await sb.from('cards').select(COLS).eq('deck_id', deckId).order('created_at'))
}

export async function createCards(sb: SupabaseClient, deckId: string, cards: { front: string; back: string }[]): Promise<Card[]> {
  if (!cards.length) return []
  return must(await sb.from('cards').insert(cards.map(c => ({ ...c, deck_id: deckId }))).select(COLS))
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
  const updated: Card = must(await sb.from('cards').update(stateToCardPatch(next)).eq('id', card.id).select(COLS).single())
  check(await sb.from('reviews').insert({
    card_id: card.id, rating, reviewed_at: now.toISOString(),
    prev_interval_days: card.interval_days, new_interval_days: next.intervalDays,
  }))
  return updated
}
