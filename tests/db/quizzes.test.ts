import { describe, it, expect, beforeAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { newUser } from './helpers'

type U = { sb: SupabaseClient; id: string }
let A: U, B: U
const questions = [
  { id: 'q1', type: 'mcq', prompt: 'Where?', options: ['a', 'b', 'c', 'd'], answer: 'b', explanation: 'x' },
  { id: 'q2', type: 'true_false', prompt: 'True?', options: null, answer: 'true', explanation: 'x' },
  { id: 'q3', type: 'short', prompt: 'Explain', options: null, answer: 'NADH', explanation: 'x' },
]
async function makeQuiz(u: U) {
  const note = (await u.sb.from('notes').insert({ title: 'N', content_md: 'x' }).select('id').single()).data!
  const quiz = (await u.sb.from('quizzes').insert({ note_id: note.id, title: 'Q', questions }).select('id').single()).data!
  const attempt = (await u.sb.from('quiz_attempts').insert({ quiz_id: quiz.id, total: 3 }).select('id').single()).data!
  return { noteId: note.id as string, quizId: quiz.id as string, attemptId: attempt.id as string }
}

beforeAll(async () => { A = await newUser(); B = await newUser() })

describe('quizzes and attempts', () => {
  it('are private to their owner', async () => {
    const { quizId, attemptId } = await makeQuiz(A)
    expect((await B.sb.from('quizzes').select('id').eq('id', quizId)).data).toEqual([])
    expect((await B.sb.from('quiz_attempts').select('id').eq('id', attemptId)).data).toEqual([])
  })
  it('cannot be attached to another student\'s note or quiz', async () => {
    const { noteId, quizId } = await makeQuiz(A)
    expect((await B.sb.from('quizzes').insert({ note_id: noteId, title: 'x', questions })).error).not.toBeNull()
    expect((await B.sb.from('quiz_attempts').insert({ quiz_id: quizId, total: 3 })).error).not.toBeNull()
  })
  it('reject bad shapes', async () => {
    const { noteId, quizId } = await makeQuiz(A)
    expect((await A.sb.from('quizzes').insert({ note_id: noteId, title: 'x', questions: [] })).error).not.toBeNull()
    expect((await A.sb.from('quiz_attempts').insert({ quiz_id: quizId, total: 3, correct: 4 })).error).not.toBeNull()
  })
  it('are deleted with their note', async () => {
    const { noteId, quizId, attemptId } = await makeQuiz(A)
    await A.sb.from('notes').delete().eq('id', noteId)
    expect((await A.sb.from('quizzes').select('id').eq('id', quizId)).data).toEqual([])
    expect((await A.sb.from('quiz_attempts').select('id').eq('id', attemptId)).data).toEqual([])
  })
})
