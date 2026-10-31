import type { SupabaseClient } from '@supabase/supabase-js'
import type { LessonScript } from '@/lib/lesson/script'
import { check, must } from './util'

// A visual lesson kept with its chat: the script (what to draw and say) and, per step, where its voice is stored
export type Lesson = { id: string; chat_id: string; message_id: string | null; title: string; script: LessonScript; created_at: string }

const COLS = 'id,chat_id,message_id,title,script,created_at'

export async function listLessons(sb: SupabaseClient, chatId: string): Promise<Lesson[]> {
  return must(await sb.from('tutor_lessons').select(COLS).eq('chat_id', chatId).order('created_at'))
}

/** Private links to each step's voice that last an hour (null where a step has none or its link could not be made) */
export async function lessonVoices(sb: SupabaseClient, script: LessonScript): Promise<(string | null)[]> {
  const paths = script.steps.map(s => s.audio ?? null)
  const real = paths.filter((p): p is string => !!p)
  if (!real.length) return paths.map(() => null)
  const { data, error } = await sb.storage.from('lessons').createSignedUrls(real, 3600)
  if (error || !data) return paths.map(() => null)
  const byPath = new Map(data.map(d => [d.path, d.signedUrl || null]))
  return paths.map(p => (p ? byPath.get(p) ?? null : null))
}

/** The voice files first (so nothing is left behind if that fails), then the lesson */
export async function deleteLesson(sb: SupabaseClient, lesson: Pick<Lesson, 'id' | 'script'>): Promise<void> {
  const paths = lesson.script.steps.map(s => s.audio).filter((p): p is string => !!p)
  if (paths.length) {
    const { error } = await sb.storage.from('lessons').remove(paths)
    if (error) throw error
  }
  check(await sb.from('tutor_lessons').delete().eq('id', lesson.id))
}
