import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchAll } from '@/lib/data/util'

// Everything a student owns, in the order it reads best. Not here: billing tokens, usage counters, and lecture audio (files, not rows).
export const EXPORT_TABLES = [
  'profiles', 'courses', 'classes', 'tasks', 'notes', 'decks', 'cards', 'reviews', 'focus_sessions',
  'quizzes', 'quiz_attempts', 'lectures', 'topics', 'topic_links', 'topic_resources', 'study_plans', 'study_plan_days',
  'tutor_chats', 'tutor_messages', 'game_plays',
] as const

export type MyData = { app: 'Studyhub'; exported_at: string; data: Record<(typeof EXPORT_TABLES)[number], unknown[]> }

// Read through the student's own session, so row-level security keeps it to their rows. All or nothing: a half export is never handed over.
export async function exportMyData(sb: SupabaseClient, now = new Date()): Promise<MyData> {
  const data = {} as MyData['data']
  for (const table of EXPORT_TABLES) {
    try {
      data[table] = await fetchAll<unknown>((from, to) => sb.from(table).select('*').order('id').range(from, to))
    } catch {
      throw new Error(`Could not read your ${table}.`)
    }
  }
  return { app: 'Studyhub', exported_at: now.toISOString(), data }
}
