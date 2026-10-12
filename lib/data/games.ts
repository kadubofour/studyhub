import type { SupabaseClient } from '@supabase/supabase-js'
import { check } from './util'
import { announceProgressChanged } from '@/lib/xp/events'

export async function recordGamePlay(sb: SupabaseClient, p: { deckId: string; game: 'match' | 'speed'; score: number; total: number }): Promise<void> {
  check(await sb.from('game_plays').insert({ deck_id: p.deckId, game: p.game, score: p.score, total: p.total }))
  announceProgressChanged()
}
