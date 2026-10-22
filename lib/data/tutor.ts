import type { SupabaseClient } from '@supabase/supabase-js'
import type { Proposal } from '@/lib/ai/tutorTools'
import type { Source } from '@/lib/ai/tutorContext'
import type { ChatContext } from '@/lib/tutor/chatList'
import type { Attachment } from '@/lib/tutor/attachments'
import { check, fetchAll, must } from './util'

export type TutorChat = { id: string; title: string; course_id: string | null; note_id: string | null; lecture_id: string | null; guided: boolean; created_at: string; updated_at: string }
export type TutorMessage = {
  id: string; chat_id: string; role: 'user' | 'assistant'; content: string; sources: Source[]; proposals: Proposal[]; status: 'ok' | 'cut_off'; created_at: string
  /** What the student added to a question (always empty on a reply) */
  attachments: Attachment[]
}
const CHAT = 'id,title,course_id,note_id,lecture_id,guided,created_at,updated_at'
const MESSAGE = 'id,chat_id,role,content,sources,proposals,status,created_at,attachments'

export async function listChats(sb: SupabaseClient): Promise<TutorChat[]> {
  return fetchAll<TutorChat>((from, to) => sb.from('tutor_chats').select(CHAT).order('updated_at', { ascending: false }).order('id').range(from, to))
}
export async function getChat(sb: SupabaseClient, id: string): Promise<TutorChat> {
  return must(await sb.from('tutor_chats').select(CHAT).eq('id', id).single())
}
export async function createChat(sb: SupabaseClient, input: { title?: string; course_id?: string | null; note_id?: string | null; lecture_id?: string | null }): Promise<TutorChat> {
  return must(await sb.from('tutor_chats').insert(input).select(CHAT).single())
}
// The newest chat about this note or lecture, so "Ask the tutor" reopens it
export async function findChat(sb: SupabaseClient, target: { note_id: string } | { lecture_id: string }): Promise<TutorChat | null> {
  const [column, value] = Object.entries(target)[0]
  return must(await sb.from('tutor_chats').select(CHAT).eq(column, value).order('updated_at', { ascending: false }).limit(1).maybeSingle())
}
export async function setChatGuided(sb: SupabaseClient, id: string, guided: boolean): Promise<void> {
  check(await sb.from('tutor_chats').update({ guided }).eq('id', id))
}
export async function renameChat(sb: SupabaseClient, id: string, title: string): Promise<void> {
  check(await sb.from('tutor_chats').update({ title }).eq('id', id))
}
export async function setChatCourse(sb: SupabaseClient, id: string, courseId: string | null): Promise<void> {
  check(await sb.from('tutor_chats').update({ course_id: courseId }).eq('id', id))
}
/** Point a chat at a note or a lecture (the other is cleared), or at neither */
export async function setChatContext(sb: SupabaseClient, id: string, target: { note_id: string } | { lecture_id: string } | null): Promise<void> {
  const patch = { note_id: null as string | null, lecture_id: null as string | null, ...target }
  check(await sb.from('tutor_chats').update(patch).eq('id', id))
}
/** What each chat is about: the title of its note or lecture, by chat id */
export async function listChatContexts(sb: SupabaseClient, chats: Pick<TutorChat, 'id' | 'note_id' | 'lecture_id'>[]): Promise<Record<string, ChatContext>> {
  const noteIds = [...new Set(chats.flatMap(c => (c.note_id ? [c.note_id] : [])))]
  const lectureIds = [...new Set(chats.flatMap(c => (c.lecture_id ? [c.lecture_id] : [])))]
  // In batches: a request carries its ids in the address, and a long list of them is too long for some servers
  const titles = async (table: 'notes' | 'lectures', ids: string[]) => {
    const out: { id: string; title: string }[] = []
    for (let i = 0; i < ids.length; i += 100) out.push(...(must(await sb.from(table).select('id,title').in('id', ids.slice(i, i + 100))) as { id: string; title: string }[]))
    return out
  }
  const [notes, lectures] = await Promise.all([titles('notes', noteIds), titles('lectures', lectureIds)])
  const note = new Map(notes.map(n => [n.id, n.title])), lecture = new Map(lectures.map(l => [l.id, l.title]))
  const out: Record<string, ChatContext> = {}
  for (const c of chats) {
    if (c.note_id && note.has(c.note_id)) out[c.id] = { kind: 'note', title: note.get(c.note_id)! }
    else if (c.lecture_id && lecture.has(c.lecture_id)) out[c.id] = { kind: 'lecture', title: lecture.get(c.lecture_id)! }
  }
  return out
}
/** The chat, its messages, and the photos and PDFs added to it. The files go first, but a failure there does not keep the chat. */
export async function deleteChat(sb: SupabaseClient, id: string): Promise<void> {
  const { data: { user } } = await sb.auth.getUser()
  if (user) {
    const folder = `${user.id}/${id}`
    const bucket = sb.storage.from('tutor-files')
    try {
      const { data } = await bucket.list(folder, { limit: 1000 })
      const paths = (data ?? []).filter(f => f.id !== null).map(f => `${folder}/${f.name}`)
      if (paths.length) await bucket.remove(paths)
    } catch { /* the files are removed with the account at the latest */ }
  }
  check(await sb.from('tutor_chats').delete().eq('id', id))
}
export async function listMessages(sb: SupabaseClient, chatId: string): Promise<TutorMessage[]> {
  return must(await sb.from('tutor_messages').select(MESSAGE).eq('chat_id', chatId).order('created_at'))
}
export async function saveProposals(sb: SupabaseClient, messageId: string, proposals: Proposal[]): Promise<void> {
  check(await sb.from('tutor_messages').update({ proposals }).eq('id', messageId))
}
