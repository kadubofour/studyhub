import type { SupabaseClient } from '@supabase/supabase-js'
import type { Review } from '../types'
import { must } from './util'

export async function listReviewsSince(sb: SupabaseClient, since: Date): Promise<Review[]> {
  return must(await sb.from('reviews').select('id,card_id,rating,reviewed_at').gte('reviewed_at', since.toISOString()).order('reviewed_at'))
}
