import { NextResponse } from 'next/server'
import { readOwnNote } from '@/lib/ai/routeNote'
import { makeQuiz, QUESTION_TYPES, QUIZ_COUNTS } from '@/lib/ai/quiz'
import { MIN_WORDS } from '@/lib/ai/summary'
import { wordCount } from '@/lib/ai/input'
import { aiErrorResponse, runAiAction } from '@/lib/ai/run'
import { removeSummary } from '@/lib/notes/summaryBlock'
import type { Quiz, QuestionType } from '@/lib/quiz/types'

export const maxDuration = 60

// POST { noteId, count: 5|10|15, types: QuestionType[] } → the saved Quiz
export async function POST(request: Request) {
  const r = await readOwnNote(request)
  if ('response' in r) return r.response
  const { count, types } = r.body as { count?: unknown; types?: unknown }
  const typeList = Array.isArray(types) ? [...new Set(types)] : []
  if (!QUIZ_COUNTS.includes(count as 5) || !typeList.length || !typeList.every(t => QUESTION_TYPES.includes(t as QuestionType))) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
  if (wordCount(removeSummary(r.note.content_md)) < MIN_WORDS) return NextResponse.json({ error: 'too_short' }, { status: 422 })

  const result = await runAiAction(async client => {
    const made = await makeQuiz(client, r.note, { count: count as number, types: typeList as QuestionType[] }, request.signal)
    const { data, error } = await r.sb.from('quizzes')
      .insert({ note_id: r.note.id, title: made.title, questions: made.questions })
      .select('id,note_id,title,questions,created_at').single()
    if (error || !data) throw new Error('save failed')
    return data as Quiz
  }, { userId: r.userId, cost: 1, signal: request.signal })
  return result.ok ? NextResponse.json(result.value) : aiErrorResponse(result.error)
}
