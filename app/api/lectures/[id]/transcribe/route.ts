import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { isAiConfigured, openai } from '@/lib/ai/openai'
import { aiErrorResponse, classifyAiError } from '@/lib/ai/run'
import { mergeParts, transcribePart } from '@/lib/ai/transcribe'
import { PART_SECONDS_DEFAULT, type LecturePart } from '@/lib/lectures/time'

// A part is at most 20 minutes, which whisper-1 transcribes well within 300 s
export const maxDuration = 300

const UUID = /^[0-9a-f-]{36}$/i
// A real part is at most 20 minutes; a "part" much longer than that wasn't recorded by Studyhub
const MAX_PART_SECONDS = PART_SECONDS_DEFAULT + 300
const err = (status: number, error: string) => NextResponse.json({ error }, { status })
const stripSegments = (p: LecturePart): LecturePart => ({ path: p.path, start: p.start, duration: p.duration, bytes: p.bytes, transcribed: p.transcribed })
type Ctx = { params: Promise<{ id: string }> }

// POST ?part=N — transcribe part N of the student's lecture accurately (Premium; fair use 20 hours
// a month). The lecture page calls it once per part, in order. The part is claimed first, so two
// requests can't transcribe or charge it twice; a finished part is never sent again. When the last
// part is done, every part's lines make the transcript (replacing the live one).
// Returns { status, done, total }.
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
  const { data: speed } = await admin.rpc('ai_check', { p_user: user.id, p_cost: 0 })
  if (speed === 'rate_limited') return aiErrorResponse('rate_limited')
  const { data: check, error: checkError } = await admin.rpc('transcription_check', { p_user: user.id, p_seconds: Math.min(7200, Math.max(0, Math.ceil(part.duration))) })
  if (checkError) return err(502, 'ai_failed')
  if (check !== 'ok') return err(402, String(check))
  const { data: claimed } = await sb.rpc('claim_lecture_part', { p_lecture: id, p_part: n })
  if (!claimed) return err(409, 'busy') // another request is transcribing it

  const release = () => sb.rpc('release_lecture_part', { p_lecture: id, p_part: n })
  const { data: file } = await sb.storage.from('lectures').download(part.path)
  if (!file) { await release(); return err(404, 'not_found') }
  await sb.from('lectures').update({ transcript_status: 'processing' }).eq('id', id)
  try {
    const { lines, seconds } = await transcribePart(openai(), Buffer.from(await file.arrayBuffer()), {
      name: part.path.slice(part.path.lastIndexOf('/') + 1), mime: String(lecture.mime), start: part.start, signal: request.signal,
    })
    // Count everything OpenAI heard, in pieces of at most 2 hours
    for (let left = seconds; left > 0; left -= 7200) {
      await admin.rpc('transcription_record', { p_user: user.id, p_lecture: id, p_seconds: Math.min(7200, left) })
    }
    if (seconds > MAX_PART_SECONDS) {
      await release()
      await sb.from('lectures').update({ transcript_status: 'failed' }).eq('id', id)
      return aiErrorResponse('too_long')
    }
    const { data: saved, error } = await sb.rpc('save_lecture_part', { p_lecture: id, p_part: n, p_segments: lines })
    if (error || !saved) throw error ?? new Error('not saved')
    const now = saved as LecturePart[]
    if (now.every(p => p.transcribed)) {
      const { error: doneError } = await sb.from('lectures').update({
        parts: now.map(stripSegments), transcript: mergeParts(now), transcript_status: 'done', transcript_source: 'openai',
      }).eq('id', id)
      if (doneError) throw doneError
    }
    return progress(now)
  } catch (e) {
    await release()
    await sb.from('lectures').update({ transcript_status: 'failed' }).eq('id', id)
    return aiErrorResponse(classifyAiError(e, request.signal))
  }
}
