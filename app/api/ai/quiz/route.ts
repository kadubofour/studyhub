import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { readOwnNote } from '@/lib/ai/routeNote'
import { makeQuiz, makeTopicQuiz, MAX_TOPIC_CHARS, QUESTION_TYPES, QUIZ_COUNTS } from '@/lib/ai/quiz'
import { MIN_WORDS } from '@/lib/ai/summary'
import { wordCount } from '@/lib/ai/input'
import { aiErrorResponse, runAiAction } from '@/lib/ai/run'
import { removeSummary } from '@/lib/notes/summaryBlock'
import type { Quiz, QuestionType } from '@/lib/quiz/types'

export const maxDuration = 60

const badRequest = () => NextResponse.json({ error: 'bad_request' }, { status: 400 })
function quizOpts(body: { count?: unknown; types?: unknown }) {
  const types = Array.isArray(body.types) ? [...new Set(body.types)] : []
  if (!QUIZ_COUNTS.includes(body.count as 5) || !types.length || !types.every(t => QUESTION_TYPES.includes(t as QuestionType))) return null
  return { count: body.count as number, types: types as QuestionType[] }
}

// POST { noteId, count: 5|10|15, types: QuestionType[] } or { topic, count, types } → the saved Quiz
export async function POST(request: Request) {
  const sent = (await request.clone().json().catch(() => null)) as { topic?: unknown } | null
  if (sent && 'topic' in sent) return fromTopic(request, sent)

  const r = await readOwnNote(request)
  if ('response' in r) return r.response
  const opts = quizOpts(r.body)
  if (!opts) return badRequest()
  if (wordCount(removeSummary(r.note.content_md)) < MIN_WORDS) return NextResponse.json({ error: 'too_short' }, { status: 422 })

  const result = await runAiAction(async client => {
    const made = await makeQuiz(client, r.note, opts, request.signal)
    const { data, error } = await r.sb.from('quizzes')
      .insert({ note_id: r.note.id, title: made.title, questions: made.questions })
      .select('id,note_id,title,questions,created_at').single()
    if (error || !data) throw new Error('save failed')
    return data as Quiz
  }, { userId: r.userId, cost: 1, signal: request.signal })
  return result.ok ? NextResponse.json(result.value) : aiErrorResponse(result.error)
}

async function fromTopic(request: Request, body: { topic?: unknown; count?: unknown; types?: unknown }) {
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const topic = typeof body.topic === 'string' ? body.topic.trim() : ''
  const opts = quizOpts(body)
  if (!topic || topic.length > MAX_TOPIC_CHARS || !opts) return badRequest()

  const result = await runAiAction(async client => {
    const made = await makeTopicQuiz(client, topic, opts, request.signal)
    const { data, error } = await sb.from('quizzes')
      .insert({ note_id: null, title: made.title, questions: made.questions })
      .select('id,note_id,title,questions,created_at').single()
    if (error || !data) throw new Error('save failed')
    return data as Quiz
  }, { userId: user.id, cost: 1, signal: request.signal })
  return result.ok ? NextResponse.json(result.value) : aiErrorResponse(result.error)
}
