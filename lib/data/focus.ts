import type { SupabaseClient } from '@supabase/supabase-js'
import type { FocusSession } from '../types'
import { check, fetchAll } from './util'
import { announceProgressChanged } from '@/lib/xp/events'

export async function logFocusSession(
  sb: SupabaseClient, s: { startedAt: Date; endedAt: Date; minutes: number; completed: boolean; taskId?: string | null; courseId?: string | null },
): Promise<void> {
  // Idempotent: the same session (user + start time) logged twice is stored once
  const row = { started_at: s.startedAt.toISOString(), ended_at: s.endedAt.toISOString(), minutes: s.minutes, completed: s.completed }
  const save = (links: { task_id: string | null; course_id: string | null }) =>
    sb.from('focus_sessions').upsert({ ...row, ...links }, { onConflict: 'user_id,started_at', ignoreDuplicates: true })
  const links = { task_id: s.taskId ?? null, course_id: s.courseId ?? null }
  let res = await save(links)
  // The task or course may have been deleted (here or on another device) since it was chosen: the minutes still count, just without the link
  if (res.error && (links.task_id || links.course_id)) res = await save({ task_id: null, course_id: null })
  check(res)
  announceProgressChanged()
}

export async function listSessionsSince(sb: SupabaseClient, since: Date): Promise<FocusSession[]> {
  return fetchAll<FocusSession>((from, to) => sb.from('focus_sessions').select('id,started_at,ended_at,minutes,completed')
    .gte('started_at', since.toISOString()).order('started_at').order('id').range(from, to))
}
