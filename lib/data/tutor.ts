import type { SupabaseClient } from '@supabase/supabase-js'
import type { Proposal } from '@/lib/ai/tutorTools'
import type { Source } from '@/lib/ai/tutorContext'
import { check, must } from './util'

export type TutorChat = { id: string; title: string; course_id: string | null; note_id: string | null; lecture_id: string | null; created_at: string; updated_at: string }
export type TutorMessage = {
  id: string; chat_id: string; role: 'user' | 'assistant'; content: string; sources: Source[]; proposals: Proposal[]; status: 'ok' | 'cut_off'; created_at: string
}
const CHAT = 'id,title,course_id,note_id,lecture_id,created_at,updated_at'
const MESSAGE = 'id,chat_id,role,content,sources,proposals,status,created_at'

export async function listChats(sb: SupabaseClient): Promise<TutorChat[]> {
  return must(await sb.from('tutor_chats').select(CHAT).order('updated_at', { ascending: false }))
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
export async function renameChat(sb: SupabaseClient, id: string, title: string): Promise<void> {
  check(await sb.from('tutor_chats').update({ title }).eq('id', id))
}
export async function setChatCourse(sb: SupabaseClient, id: string, courseId: string | null): Promise<void> {
  check(await sb.from('tutor_chats').update({ course_id: courseId }).eq('id', id))
}
export async function deleteChat(sb: SupabaseClient, id: string): Promise<void> {
  check(await sb.from('tutor_chats').delete().eq('id', id))
}
export async function listMessages(sb: SupabaseClient, chatId: string): Promise<TutorMessage[]> {
  return must(await sb.from('tutor_messages').select(MESSAGE).eq('chat_id', chatId).order('created_at'))
}
export async function saveProposals(sb: SupabaseClient, messageId: string, proposals: Proposal[]): Promise<void> {
  check(await sb.from('tutor_messages').update({ proposals }).eq('id', messageId))
}
