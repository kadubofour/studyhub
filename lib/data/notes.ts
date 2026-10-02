import type { SupabaseClient } from '@supabase/supabase-js'
import type { Note, NoteSummary } from '../types'
import { check, fetchAll, must } from './util'

export async function listNotes(sb: SupabaseClient): Promise<NoteSummary[]> {
  return must(await sb.from('notes').select('id,course_id,title,updated_at').order('updated_at', { ascending: false }))
}

export async function getNote(sb: SupabaseClient, id: string): Promise<Note> {
  return must(await sb.from('notes').select('id,course_id,title,content_md,updated_at').eq('id', id).single())
}

export async function createNote(
  sb: SupabaseClient, input: { title?: string; content_md?: string; course_id?: string | null },
): Promise<Note> {
  return must(await sb.from('notes').insert(input).select('id,course_id,title,content_md,updated_at').single())
}

export async function updateNote(
  sb: SupabaseClient, id: string, patch: Partial<Pick<Note, 'title' | 'content_md' | 'course_id'>>,
): Promise<void> {
  check(await sb.from('notes').update(patch).eq('id', id))
}

export async function deleteNote(sb: SupabaseClient, id: string): Promise<void> {
  check(await sb.from('notes').delete().eq('id', id))
}

// Matches titles and note text (case-insensitive); see search_notes in the migrations
export async function searchNotes(sb: SupabaseClient, q: string): Promise<NoteSummary[]> {
  return must(await sb.rpc('search_notes', { p_q: q }))
}

// Full notes for export: the given ids in that order, or every note (oldest first) when ids is omitted
export async function getNotesForExport(sb: SupabaseClient, ids?: string[]): Promise<Note[]> {
  const cols = 'id,course_id,title,content_md,updated_at'
  if (!ids) return fetchAll<Note>((from, to) => sb.from('notes').select(cols).order('created_at').order('id').range(from, to))
  if (!ids.length) return []
  const rows = await fetchAll<Note>((from, to) => sb.from('notes').select(cols).in('id', ids).order('id').range(from, to))
  const byId = new Map(rows.map(r => [r.id, r]))
  return ids.flatMap(id => (byId.has(id) ? [byId.get(id)!] : []))
}
