import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { aiErrorResponse, runAiAction } from '@/lib/ai/run'
import { markShortAnswer } from '@/lib/ai/markAnswer'
import { markInstant } from '@/lib/quiz/marking'
import type { Question } from '@/lib/quiz/types'

export const maxDuration = 60
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const bad = () => NextResponse.json({ error: 'bad_request' }, { status: 400 })

// POST { attemptId, questionId, answer } → { correct, feedback } for a short answer in an unfinished
// attempt. Exact matches are marked without AI; others go through the speed-limited AI helper.
export async function POST(request: Request) {
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = (await request.json().catch(() => null)) as { attemptId?: unknown; questionId?: unknown; answer?: unknown } | null
  const { attemptId, questionId, answer } = body ?? {}
  if (typeof attemptId !== 'string' || !UUID.test(attemptId) || typeof questionId !== 'string'
    || typeof answer !== 'string' || !answer.trim() || answer.length > 1000) return bad()

  const { data: attempt } = await sb.from('quiz_attempts').select('id,finished_at,quizzes(questions)').eq('id', attemptId).maybeSingle()
  const questions = ((attempt as { quizzes?: { questions?: Question[] } } | null)?.quizzes?.questions ?? []) as Question[]
  const q = questions.find(x => x.id === questionId)
  if (!attempt || !q) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (q.type !== 'short') return bad()
  if ((attempt as { finished_at: string | null }).finished_at) return NextResponse.json({ error: 'finished' }, { status: 409 })

  if (markInstant(q, answer) === true) return NextResponse.json({ correct: true, feedback: q.explanation })
  const result = await runAiAction(client => markShortAnswer(client, q, answer, request.signal), { userId: user.id, cost: 0, signal: request.signal })
  return result.ok ? NextResponse.json(result.value) : aiErrorResponse(result.error)
}
