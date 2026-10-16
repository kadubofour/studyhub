import type { SupabaseClient } from '@supabase/supabase-js'
import type { AnswerRecord, Quiz, QuizAttempt } from '../types'
import { check, fetchAll, must } from './util'
import { announceProgressChanged } from '@/lib/xp/events'

const QUIZ = 'id,note_id,title,questions,created_at'
const ATTEMPT = 'id,quiz_id,answers,correct,total,started_at,finished_at'

export async function getQuiz(sb: SupabaseClient, id: string): Promise<Quiz> {
  return must(await sb.from('quizzes').select(QUIZ).eq('id', id).single())
}

export async function listQuizSummaries(sb: SupabaseClient, noteId: string) {
  const quizzes: Quiz[] = must(await sb.from('quizzes').select(QUIZ).eq('note_id', noteId).order('created_at', { ascending: false }))
  if (!quizzes.length) return []
  const attempts: QuizAttempt[] = must(await sb.from('quiz_attempts').select(ATTEMPT)
    .in('quiz_id', quizzes.map(q => q.id)).not('finished_at', 'is', null))
  return quizzes.map(quiz => {
    const mine = attempts.filter(a => a.quiz_id === quiz.id)
    const best = mine.reduce<QuizAttempt | null>((b, a) => (!b || a.correct / a.total > b.correct / b.total ? a : b), null)
    return { quiz, attempts: mine.length, best: best && { correct: best.correct, total: best.total } }
  })
}

/** A quiz of just these questions (the ones missed), on the same note. Nothing is written by AI: the questions are copied. */
export async function createRetryQuiz(sb: SupabaseClient, quiz: Quiz, questions: Quiz['questions']): Promise<Quiz> {
  const suffix = ' · missed'
  const title = `${quiz.title.replace(/ · missed$/, '').slice(0, 200 - suffix.length)}${suffix}` // the title column holds 200 characters
  return must(await sb.from('quizzes').insert({ note_id: quiz.note_id, title, questions }).select(QUIZ).single())
}

/** The latest quizzes across every note, with the best score and how many times each was finished */
export async function listRecentQuizzes(sb: SupabaseClient, limit = 8) {
  const quizzes: Quiz[] = must(await sb.from('quizzes').select(QUIZ).order('created_at', { ascending: false }).limit(limit))
  if (!quizzes.length) return []
  const attempts: QuizAttempt[] = must(await sb.from('quiz_attempts').select(ATTEMPT).in('quiz_id', quizzes.map(q => q.id)).not('finished_at', 'is', null))
  return quizzes.map(quiz => {
    const mine = attempts.filter(a => a.quiz_id === quiz.id)
    const best = mine.reduce<QuizAttempt | null>((b, a) => (!b || a.correct / a.total > b.correct / b.total ? a : b), null)
    return { quiz, attempts: mine.length, best: best && { correct: best.correct, total: best.total } }
  })
}

export async function getOpenAttempt(sb: SupabaseClient, quizId: string): Promise<QuizAttempt | null> {
  return must(await sb.from('quiz_attempts').select(ATTEMPT).eq('quiz_id', quizId).is('finished_at', null)
    .order('started_at', { ascending: false }).limit(1).maybeSingle())
}

export async function latestFinishedAttempt(sb: SupabaseClient, quizId: string, exceptId?: string): Promise<QuizAttempt | null> {
  let q = sb.from('quiz_attempts').select(ATTEMPT).eq('quiz_id', quizId).not('finished_at', 'is', null)
  if (exceptId) q = q.neq('id', exceptId)
  return must(await q.order('finished_at', { ascending: false }).limit(1).maybeSingle())
}

export async function startAttempt(sb: SupabaseClient, quiz: Quiz): Promise<QuizAttempt> {
  return must(await sb.from('quiz_attempts').insert({ quiz_id: quiz.id, total: quiz.questions.length }).select(ATTEMPT).single())
}

export async function saveAttempt(sb: SupabaseClient, id: string, answers: Record<string, AnswerRecord>, correct: number): Promise<void> {
  check(await sb.from('quiz_attempts').update({ answers, correct }).eq('id', id))
}

export async function finishAttempt(sb: SupabaseClient, id: string, answers: Record<string, AnswerRecord>, correct: number): Promise<QuizAttempt> {
  const done = must(await sb.from('quiz_attempts').update({ answers, correct, finished_at: new Date().toISOString() }).eq('id', id).select(ATTEMPT).single<QuizAttempt>())
  announceProgressChanged()
  return done
}

export async function listFinishedAttemptsSince(sb: SupabaseClient, since: Date) {
  const rows: { id: string; correct: number; total: number; finished_at: string; quizzes: { title: string; notes: { course_id: string | null } | null } | null }[] =
    must(await sb.from('quiz_attempts').select('id,correct,total,finished_at,quizzes(title,notes(course_id))')
      .not('finished_at', 'is', null).gte('finished_at', since.toISOString()).order('finished_at')) as unknown as
      // PostgREST returns these many-to-one joins as single objects; without generated types they're typed as lists
      never
  return rows.map(r => ({
    id: r.id, correct: r.correct, total: r.total, finished_at: r.finished_at,
    quiz_title: r.quizzes?.title ?? 'Quiz', course_id: r.quizzes?.notes?.course_id ?? null,
  }))
}

/** Everything the Quiz page shows: every quiz, every finished attempt, and the notes and courses they belong to */
export async function listQuizHub(sb: SupabaseClient) {
  const coursesQuery = sb.from('courses').select('id,name,color') // started with the others, answered after them
  const [quizzes, attempts, notes, courseRows] = await Promise.all([
    fetchAll<Quiz>((from, to) => sb.from('quizzes').select(QUIZ).order('created_at', { ascending: false }).order('id').range(from, to)),
    fetchAll<{ id: string; quiz_id: string; correct: number; total: number; finished_at: string }>((from, to) =>
      sb.from('quiz_attempts').select('id,quiz_id,correct,total,finished_at').not('finished_at', 'is', null).order('finished_at').order('id').range(from, to)),
    fetchAll<{ id: string; title: string; course_id: string | null }>((from, to) => sb.from('notes').select('id,title,course_id').order('id').range(from, to)),
    Promise.resolve(coursesQuery).then(r => must(r) as { id: string; name: string; color: string }[]),
  ])
  return { quizzes, attempts, notes, courses: courseRows }
}

export async function deleteQuiz(sb: SupabaseClient, id: string): Promise<void> {
  check(await sb.from('quizzes').delete().eq('id', id))
  announceProgressChanged()
}
