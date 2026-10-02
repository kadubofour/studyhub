import type { SupabaseClient } from '@supabase/supabase-js'
import type { Note, NoteSummary } from '../types'
import { check, must } from './util'

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
