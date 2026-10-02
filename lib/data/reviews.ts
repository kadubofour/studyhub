import type { SupabaseClient } from '@supabase/supabase-js'
import type { Review } from '../types'
import { fetchAll } from './util'

export async function listReviewsSince(sb: SupabaseClient, since: Date): Promise<Review[]> {
  return fetchAll<Review>((from, to) => sb.from('reviews').select('id,card_id,rating,reviewed_at')
    .gte('reviewed_at', since.toISOString()).order('reviewed_at').order('id').range(from, to))
}
