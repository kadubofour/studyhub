import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { aiErrorResponse, runAiAction } from '@/lib/ai/run'
import { writeLesson } from '@/lib/ai/lesson'

export const maxDuration = 90

// POST { question, answer } → { script }: the drawing for a live session, made as the conversation goes. Nothing is stored and no voice is made here:
// the session speaks each step as it is shown. One AI action, like writing any other lesson.
export async function POST(request: Request) {
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = (await request.json().catch(() => null)) as { question?: unknown; answer?: unknown; title?: unknown } | null
  const question = typeof body?.question === 'string' ? body.question.trim() : ''
  const answer = typeof body?.answer === 'string' ? body.answer.trim() : ''
  if (!question || !answer || question.length > 4000 || answer.length > 12000) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  const title = typeof body?.title === 'string' ? body.title.slice(0, 200) : undefined
  const result = await runAiAction(client => writeLesson(client, { question, answer, title }, request.signal), { userId: user.id, cost: 1, signal: request.signal })
  return result.ok ? NextResponse.json({ script: result.value }) : aiErrorResponse(result.error)
}
