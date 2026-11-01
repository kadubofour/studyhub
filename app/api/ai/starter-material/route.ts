import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { aiErrorResponse, runAiAction } from '@/lib/ai/run'
import { MATERIAL_COST, draftStarterMaterial, oneLine } from '@/lib/ai/programme'

export const maxDuration = 60

// POST { course, programme?, school?, year? } → { topics: [{ name, note_md }] }. Drafts a course's topics, each with a short note;
// the browser saves what the student keeps.
export async function POST(request: Request) {
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null) as { course?: unknown; programme?: unknown; school?: unknown; year?: unknown } | null
  const course = oneLine(body?.course, 80)
  if (!course) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  const about = { course, programme: oneLine(body?.programme), school: oneLine(body?.school), year: oneLine(body?.year, 40) }
  const result = await runAiAction(client => draftStarterMaterial(client, about, request.signal), { userId: user.id, cost: MATERIAL_COST, signal: request.signal })
  return result.ok ? NextResponse.json(result.value) : aiErrorResponse(result.error)
}
