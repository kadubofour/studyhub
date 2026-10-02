import type { SupabaseClient } from '@supabase/supabase-js'
import type { FocusSession } from '../types'
import { check, fetchAll } from './util'

export async function logFocusSession(
  sb: SupabaseClient, s: { startedAt: Date; endedAt: Date; minutes: number; completed: boolean },
): Promise<void> {
  check(await sb.from('focus_sessions').insert({
    started_at: s.startedAt.toISOString(), ended_at: s.endedAt.toISOString(), minutes: s.minutes, completed: s.completed,
  }))
}

export async function listSessionsSince(sb: SupabaseClient, since: Date): Promise<FocusSession[]> {
  return fetchAll<FocusSession>((from, to) => sb.from('focus_sessions').select('id,started_at,ended_at,minutes,completed')
    .gte('started_at', since.toISOString()).order('started_at').order('id').range(from, to))
}
