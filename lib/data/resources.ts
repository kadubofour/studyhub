import type { SupabaseClient } from '@supabase/supabase-js'
import { check, must } from './util'

export const MAX_SAVED = 20
export type Resource = { id: string; topic_id: string; url: string; title: string; kind: 'video' | 'article' }
type NewResource = { url: string; title: string; kind: 'video' | 'article' }

export async function listResources(sb: SupabaseClient, topicId: string): Promise<Resource[]> {
  return must(await sb.from('topic_resources').select('id,topic_id,url,title,kind').eq('topic_id', topicId).order('kind', { ascending: false }).order('created_at').order('id'))
}

// A link already saved for the topic is skipped
export async function saveResources(sb: SupabaseClient, topicId: string, list: NewResource[]): Promise<void> {
  if (!list.length) return
  // One insert gives every row the same time, so each gets its own millisecond to keep the order it came in
  const base = Date.now()
  check(await sb.from('topic_resources').upsert(list.map((r, i) => ({ ...r, topic_id: topicId, created_at: new Date(base + i).toISOString() })), { onConflict: 'topic_id,url', ignoreDuplicates: true }))
}

export async function removeResource(sb: SupabaseClient, id: string): Promise<void> {
  check(await sb.from('topic_resources').delete().eq('id', id))
}
