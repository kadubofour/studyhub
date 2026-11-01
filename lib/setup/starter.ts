import type { SupabaseClient } from '@supabase/supabase-js'
import { createNote } from '@/lib/data/notes'
import { saveCourseTopics } from '@/lib/data/topics'
import type { StarterTopic } from '@/lib/ai/programme'

// Saves a course's starter material: a note for each topic, then the topics, each linked to its note.
// Returns how many topics were made. A note that can't be saved is left out with its topic.
export async function saveStarterMaterial(sb: SupabaseClient, courseId: string, topics: StarterTopic[]): Promise<number> {
  const made: { name: string; noteId: string }[] = []
  for (const t of topics) {
    try { made.push({ name: t.name, noteId: (await createNote(sb, { title: t.name, content_md: t.note_md, course_id: courseId })).id }) } catch { /* the rest still goes in */ }
  }
  if (!made.length) throw new Error('no notes saved')
  await saveCourseTopics(sb, courseId, made.map(m => ({ name: m.name, links: [{ kind: 'note' as const, id: m.noteId }] })))
  return made.length
}
