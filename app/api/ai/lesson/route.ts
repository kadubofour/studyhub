import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { aiErrorResponse, runAiAction } from '@/lib/ai/run'
import { speakStep, writeLesson } from '@/lib/ai/lesson'
import type { LessonScript } from '@/lib/lesson/script'

// Writing the lesson, then speaking up to eight steps, takes a while
export const maxDuration = 120
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const bad = () => NextResponse.json({ error: 'bad_request' }, { status: 400 })
// A lesson is two AI actions: the script and the voice
export const LESSON_COST = 2

// POST { chatId, messageId } → { id, script }: the lesson for one of the tutor's replies, drawn and spoken, and kept with the chat.
// The question is the student's message before it; the answer is the reply itself.
export async function POST(request: Request) {
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = (await request.json().catch(() => null)) as { chatId?: unknown; messageId?: unknown } | null
  const { chatId, messageId } = body ?? {}
  if (typeof chatId !== 'string' || !UUID.test(chatId) || typeof messageId !== 'string' || !UUID.test(messageId)) return bad()

  // the student's own chat and reply only (row-level security)
  const { data: chat } = await sb.from('tutor_chats').select('id,title').eq('id', chatId).maybeSingle()
  const { data: msgs } = await sb.from('tutor_messages').select('id,role,content,created_at').eq('chat_id', chatId).order('created_at')
  const at = (msgs ?? []).findIndex(m => m.id === messageId)
  const reply = at >= 0 ? msgs![at] : null
  if (!chat || !reply || reply.role !== 'assistant' || !reply.content.trim()) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const question = [...msgs!.slice(0, at)].reverse().find(m => m.role === 'user')?.content ?? ''

  const result = await runAiAction(async client => {
    const script = await writeLesson(client, { question, answer: reply.content, title: chat.title }, request.signal)
    const voices = await Promise.all(script.steps.map(s => speakStep(client, s.narration, request.signal)))
    // stored in the student's own folder; a failure here gives the AI actions back (runAiAction releases them)
    const id = crypto.randomUUID()
    const paths = script.steps.map((_, i) => `${user.id}/${chatId}/${id}-${i}.mp3`)
    const stored: string[] = []
    try {
      for (let i = 0; i < voices.length; i++) {
        const { error } = await sb.storage.from('lessons').upload(paths[i], voices[i], { contentType: 'audio/mpeg' })
        if (error) throw error
        stored.push(paths[i])
      }
      const withVoice: LessonScript = { ...script, steps: script.steps.map((s, i) => ({ ...s, audio: paths[i] })) }
      const { error } = await sb.from('tutor_lessons').insert({ id, chat_id: chatId, message_id: messageId, title: script.title, script: withVoice })
      if (error) throw error
      return { id, script: withVoice }
    } catch (e) {
      if (stored.length) await sb.storage.from('lessons').remove(stored).catch(() => {})
      throw e
    }
  }, { userId: user.id, cost: LESSON_COST, signal: request.signal })
  return result.ok ? NextResponse.json(result.value) : aiErrorResponse(result.error)
}
