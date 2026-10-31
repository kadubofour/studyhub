import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { aiErrorResponse } from '@/lib/ai/run'
import { isAiConfigured, openai } from '@/lib/ai/openai'
import { speakStep } from '@/lib/ai/lesson'

export const maxDuration = 30
const MAX_TEXT = 600
const PER_MINUTE = 60 // a live session says a sentence or two every few seconds; this is well above that and far below abuse

// A best-effort speed limit for this server instance. The tutor message that a spoken reply belongs to is already counted against the student's
// plan, so the voice is not counted again: it would use up the 10-a-minute AI speed limit with a single reply.
const recent = new Map<string, number[]>()
function tooFast(userId: string, now = Date.now()) {
  const list = (recent.get(userId) ?? []).filter(t => now - t < 60_000)
  list.push(now)
  recent.set(userId, list)
  if (recent.size > 5000) for (const [k, v] of recent) if (v.every(t => now - t >= 60_000)) recent.delete(k)
  return list.length > PER_MINUTE
}

// POST { text } → audio/mpeg: one piece of a live session, spoken in the tutor's voice.
export async function POST(request: Request) {
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = (await request.json().catch(() => null)) as { text?: unknown } | null
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!text || text.length > MAX_TEXT) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  if (!isAiConfigured()) return aiErrorResponse('ai_unavailable')
  if (tooFast(user.id)) return aiErrorResponse('rate_limited')
  try {
    const audio = await speakStep(openai(), text, request.signal)
    return new Response(new Uint8Array(audio), { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, no-store' } })
  } catch {
    return request.signal.aborted ? aiErrorResponse('aborted') : aiErrorResponse('ai_failed')
  }
}
