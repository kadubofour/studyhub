import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { aiErrorResponse, runAiAction } from '@/lib/ai/run'
import { markCardAnswer } from '@/lib/ai/markAnswer'
import { checkAnswer } from '@/lib/ui/answerCheck'

export const maxDuration = 60
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const bad = () => NextResponse.json({ error: 'bad_request' }, { status: 400 })

// POST { cardId, answer } → { verdict, feedback } for an answer typed in review, judged by meaning. A match is marked without AI;
// others go through the speed-limited AI helper at no cost, like quiz marking.
export async function POST(request: Request) {
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = (await request.json().catch(() => null)) as { cardId?: unknown; answer?: unknown } | null
  const { cardId, answer } = body ?? {}
  if (typeof cardId !== 'string' || !UUID.test(cardId) || typeof answer !== 'string' || !answer.trim() || answer.length > 1000) return bad()

  // the student's own card only (row-level security)
  const { data: card } = await sb.from('cards').select('front,back').eq('id', cardId).maybeSingle()
  if (!card) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  if (checkAnswer(answer, card.back).verdict === 'correct') return NextResponse.json({ verdict: 'correct', feedback: '' })
  const result = await runAiAction(client => markCardAnswer(client, card, answer, request.signal), { userId: user.id, cost: 0, signal: request.signal })
  return result.ok ? NextResponse.json(result.value) : aiErrorResponse(result.error)
}
