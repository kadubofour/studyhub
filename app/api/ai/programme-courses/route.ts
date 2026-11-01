import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { aiErrorResponse, runAiAction } from '@/lib/ai/run'
import { SUGGEST_COST, oneLine, suggestCourses } from '@/lib/ai/programme'

export const maxDuration = 30

// POST { programme, school?, year? } → { courses: string[] }. Suggests the courses of a programme; nothing is saved here.
export async function POST(request: Request) {
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null) as { programme?: unknown; school?: unknown; year?: unknown } | null
  const programme = oneLine(body?.programme)
  if (programme.length < 2) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  const about = { programme, school: oneLine(body?.school), year: oneLine(body?.year, 40) }
  const result = await runAiAction(client => suggestCourses(client, about, request.signal), { userId: user.id, cost: SUGGEST_COST, signal: request.signal })
  return result.ok ? NextResponse.json(result.value) : aiErrorResponse(result.error)
}
