import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { isAiConfigured, openai } from '@/lib/ai/openai'
import { aiErrorResponse, classifyAiError } from '@/lib/ai/run'
import { mergeParts, transcribePart } from '@/lib/ai/transcribe'
import type { LecturePart } from '@/lib/lectures/time'

// A part is at most 20 minutes, which whisper-1 transcribes well within 300 s
export const maxDuration = 300

const UUID = /^[0-9a-f-]{36}$/i
const err = (status: number, error: string) => NextResponse.json({ error }, { status })
const stripSegments = (p: LecturePart): LecturePart => ({ path: p.path, start: p.start, duration: p.duration, bytes: p.bytes, transcribed: p.transcribed })
const capSeconds = (s: number) => Math.min(7200, Math.max(0, Math.ceil(s)))
type Ctx = { params: Promise<{ id: string }> }

// POST ?part=N — transcribe part N of the student's lecture accurately (Premium; fair use 20 hours
// a month). The lecture page calls it once per part, in order; a finished part isn't sent again.
// When the last part is done, its lines and the earlier parts' make the transcript (replacing the
// live one). Returns { status, done, total }.
export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params
  const n = Number(new URL(request.url).searchParams.get('part'))
  if (!UUID.test(id) || !Number.isInteger(n) || n < 0) return err(400, 'bad_request')
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return err(401, 'unauthorized')

  // Read with the student's own session: row-level security means it can only be their lecture
  const { data: lecture } = await sb.from('lectures').select('id,mime,parts').eq('id', id).maybeSingle()
  if (!lecture) return err(404, 'not_found')
  const parts = lecture.parts as LecturePart[]
  const part = parts[n]
  if (!part) return err(404, 'not_found')
  const progress = (ps: LecturePart[]) => NextResponse.json({
    status: ps.every(p => p.transcribed) ? 'done' : 'processing', done: ps.filter(p => p.transcribed).length, total: ps.length,
  })
  if (part.transcribed) return progress(parts)
  if (!isAiConfigured()) return aiErrorResponse('ai_unavailable')

  const admin = adminClient()
  const { data: check, error: checkError } = await admin.rpc('transcription_check', { p_user: user.id, p_seconds: capSeconds(part.duration) })
  if (checkError) return err(502, 'ai_failed')
  if (check !== 'ok') return err(402, String(check))

  const { data: file } = await sb.storage.from('lectures').download(part.path)
  if (!file) return err(404, 'not_found')
  await sb.from('lectures').update({ transcript_status: 'processing' }).eq('id', id)
  try {
    const { lines, seconds } = await transcribePart(openai(), Buffer.from(await file.arrayBuffer()), {
      name: part.path.slice(part.path.lastIndexOf('/') + 1), mime: String(lecture.mime), start: part.start, signal: request.signal,
    })
    const next = parts.map((p, i) => (i === n ? { ...p, transcribed: true, segments: lines } : p))
    const done = next.every(p => p.transcribed)
    const { error } = await sb.from('lectures').update(done
      ? { parts: next.map(stripSegments), transcript: mergeParts(next), transcript_status: 'done', transcript_source: 'openai' }
      : { parts: next }).eq('id', id)
    if (error) throw error
    await admin.rpc('transcription_record', { p_user: user.id, p_lecture: id, p_seconds: capSeconds(seconds) })
    return progress(next)
  } catch (e) {
    await sb.from('lectures').update({ transcript_status: 'failed' }).eq('id', id)
    return aiErrorResponse(classifyAiError(e, request.signal))
  }
}
