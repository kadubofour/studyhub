import type { SupabaseClient } from '@supabase/supabase-js'
import type { Notebook } from '../types'
import { check, must } from './util'

export async function listNotebooks(sb: SupabaseClient): Promise<Notebook[]> {
  return must(await sb.from('notebooks').select('id,name,course_id,created_at').order('created_at').order('id'))
}

export async function createNotebook(sb: SupabaseClient, name: string, courseId: string | null = null): Promise<Notebook> {
  return must(await sb.from('notebooks').insert({ name: name.trim(), course_id: courseId }).select('id,name,course_id,created_at').single())
}

/** Its name, its course (null for none), or both */
export async function updateNotebook(sb: SupabaseClient, id: string, patch: { name?: string; course_id?: string | null }): Promise<void> {
  check(await sb.from('notebooks').update(patch.name === undefined ? patch : { ...patch, name: patch.name.trim() }).eq('id', id))
}

export async function renameNotebook(sb: SupabaseClient, id: string, name: string): Promise<void> {
  check(await sb.from('notebooks').update({ name: name.trim() }).eq('id', id))
}

/** Its notes are kept: they become unfiled */
export async function deleteNotebook(sb: SupabaseClient, id: string): Promise<void> {
  check(await sb.from('notebooks').delete().eq('id', id))
}

/** Puts the notes in a notebook (or in none, with null). All or nothing. */
export async function moveNotes(sb: SupabaseClient, noteIds: string[], notebookId: string | null): Promise<void> {
  if (!noteIds.length) return
  check(await sb.from('notes').update({ notebook_id: notebookId }).in('id', noteIds))
}
