import type { SupabaseClient } from '@supabase/supabase-js'
import type { Course } from '../types'
import { check, must } from './util'

const COLS = 'id,name,color'

export async function listCourses(sb: SupabaseClient): Promise<Course[]> {
  return must(await sb.from('courses').select(COLS).order('created_at'))
}

export async function createCourse(sb: SupabaseClient, input: { name: string; color: string }): Promise<Course> {
  return must(await sb.from('courses').insert(input).select(COLS).single())
}

export async function updateCourse(sb: SupabaseClient, id: string, patch: Partial<Omit<Course, 'id'>>): Promise<void> {
  check(await sb.from('courses').update(patch).eq('id', id))
}

export async function deleteCourse(sb: SupabaseClient, id: string, opts: { deleteContents: boolean }): Promise<void> {
  if (opts.deleteContents) {
    for (const table of ['tasks', 'notes', 'decks'] as const) {
      check(await sb.from(table).delete().eq('course_id', id))
    }
  }
  // tasks/notes/decks: ON DELETE SET NULL; classes: ON DELETE CASCADE
  check(await sb.from('courses').delete().eq('id', id))
}
