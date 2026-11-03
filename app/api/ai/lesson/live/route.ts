import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { aiErrorResponse, runAiAction } from '@/lib/ai/run'
import { writeLesson } from '@/lib/ai/lesson'
import { lessonMaterial } from '@/lib/ai/lessonMaterial'

export const maxDuration = 90
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// POST { question, answer, chatId? } → { script }: the drawing for a live session, made as the conversation goes. Nothing is stored and no voice is made here:
// the session speaks each step as it is shown. One AI action, like writing any other lesson.
export async function POST(request: Request) {
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = (await request.json().catch(() => null)) as { question?: unknown; answer?: unknown; title?: unknown; chatId?: unknown } | null
  const question = typeof body?.question === 'string' ? body.question.trim() : ''
  const answer = typeof body?.answer === 'string' ? body.answer.trim() : ''
  if (!question || !answer || question.length > 4000 || answer.length > 12000) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  const title = typeof body?.title === 'string' ? body.title.slice(0, 200) : undefined
  // the student's own chat only (row-level security); with no chat, the lesson still finds what matches the question
  const { data: chat } = typeof body?.chatId === 'string' && UUID.test(body.chatId)
    ? await sb.from('tutor_chats').select('note_id,lecture_id').eq('id', body.chatId).maybeSingle()
    : { data: null }
  const result = await runAiAction(async client => {
    const material = await lessonMaterial(sb, chat ?? {}, question)
    return writeLesson(client, { question, answer, title, material }, request.signal)
  }, { userId: user.id, cost: 1, signal: request.signal })
  return result.ok ? NextResponse.json({ script: result.value }) : aiErrorResponse(result.error)
}
