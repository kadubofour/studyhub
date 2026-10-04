import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { aiErrorResponse, runAiAction } from '@/lib/ai/run'
import { LECTURE_NOTE_COST, lectureToNote } from '@/lib/ai/lectureNote'
import type { TranscriptLine } from '@/lib/lectures/time'

// A two-hour transcript is long; 300 s is the Hobby plan's maximum
export const maxDuration = 300
const UUID = /^[0-9a-f-]{36}$/i

// POST { lectureId } → { title, content_md, truncated } — a note drafted from the lecture's
// transcript. The browser saves it as a note and links it to the lecture.
export async function POST(request: Request) {
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null) as { lectureId?: unknown } | null
  const id = typeof body?.lectureId === 'string' && UUID.test(body.lectureId) ? body.lectureId : null
  if (!id) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  // Read with the student's own session: row-level security means it can only be their lecture
  const { data: lecture } = await sb.from('lectures').select('title,transcript').eq('id', id).maybeSingle()
  if (!lecture) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const transcript = lecture.transcript as TranscriptLine[]
  if (!transcript.length) return aiErrorResponse('empty')
  const result = await runAiAction(client => lectureToNote(client, { title: lecture.title as string, transcript }, request.signal),
    { userId: user.id, cost: LECTURE_NOTE_COST, signal: request.signal })
  return result.ok ? NextResponse.json(result.value) : aiErrorResponse(result.error)
}
