import type { SupabaseClient } from '@supabase/supabase-js'
import { buildContext, type Material } from './tutorContext'
import { transcriptText } from './lectureNote'
import { stripImagesForAi } from '@/lib/notes/images'
import { stripMarkupForAi } from '@/lib/notes/markup'

/**
 * What a visual lesson can teach from besides the tutor's reply: the note or lecture the chat is about, and whatever else of the student's matches the
 * question. Read with the student's own session, so only their things. A lesson can be made without any of it, so a failure here gives nothing rather than an error.
 */
export async function lessonMaterial(sb: SupabaseClient, chat: { note_id?: string | null; lecture_id?: string | null }, question: string): Promise<string> {
  try {
    let attached: Material | null = null
    if (chat.note_id) {
      const { data: n } = await sb.from('notes').select('id,title,content_md').eq('id', chat.note_id).maybeSingle()
      if (n) attached = { kind: 'note', id: n.id, title: n.title, text: stripMarkupForAi(stripImagesForAi(n.content_md)) }
    } else if (chat.lecture_id) {
      const { data: l } = await sb.from('lectures').select('id,title,transcript').eq('id', chat.lecture_id).maybeSingle()
      if (l) attached = { kind: 'lecture', id: l.id, title: l.title, text: transcriptText(l.transcript as Parameters<typeof transcriptText>[0]) }
    }
    const { data: found } = await sb.rpc('tutor_find_material', { p_query: question.slice(0, 500), p_limit: 6 })
    const matches = ((found ?? []) as { kind: Material['kind']; id: string; title: string; snippet: string }[]).map(m => ({ kind: m.kind, id: m.id, title: m.title, text: m.snippet }))
    return buildContext({ attached, matches, courses: [], decks: [] }).text
  } catch {
    return ''
  }
}
