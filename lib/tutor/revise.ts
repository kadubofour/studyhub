import type { SupabaseClient } from '@supabase/supabase-js'
import { listTopicLinks } from '@/lib/data/topics'
import { createChat } from '@/lib/data/tutor'

// A tutor chat about a topic, ready for the student to send: about the topic's newest linked note (or just its
// course), with "Quiz me on <topic>" waiting in the message box. Nothing is sent and no tutor message is spent here.
export async function startRevision(sb: SupabaseClient, topic: { id: string; name: string }, courseId: string): Promise<string> {
  // The topic may have been deleted since the card loaded: then there is nothing to revise
  const { data: exists } = await sb.from('topics').select('id').eq('id', topic.id).maybeSingle()
  if (!exists) throw new Error('topic_gone')
  const noteIds = (await listTopicLinks(sb, courseId)).filter(l => l.topic_id === topic.id && l.link.kind === 'note').map(l => l.link.id)
  let noteId: string | null = null
  if (noteIds.length) {
    const { data } = await sb.from('notes').select('id,updated_at').in('id', noteIds).order('updated_at', { ascending: false }).limit(1)
    noteId = (data as { id: string }[] | null)?.[0]?.id ?? null
  }
  const chat = await createChat(sb, { title: topic.name.slice(0, 200), course_id: courseId, ...(noteId ? { note_id: noteId } : {}) })
  return `/tutor/${chat.id}?ask=${encodeURIComponent(`Quiz me on ${topic.name}`)}`
}
