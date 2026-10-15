import { describe, it, expect, beforeAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { newUser } from './helpers'
import { createRetryQuiz, listRecentQuizzes } from '@/lib/data/quizzes'

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

describe('retaking the missed questions', () => {
  it('makes a quiz of just those questions on the same note, titled as missed, and lists it with the latest quizzes', async () => {
    const { noteId, quizId } = await makeQuiz(A)
    const quiz = { id: quizId, note_id: noteId, title: 'Q', questions, created_at: '' } as never
    const again = await createRetryQuiz(A.sb, quiz, questions.slice(1) as never)
    expect(again.title).toBe('Q · missed')
    expect(again.note_id).toBe(noteId)
    expect(again.questions.map(q => q.id)).toEqual(['q2', 'q3'])
    const twice = await createRetryQuiz(A.sb, again, questions.slice(2) as never)
    expect(twice.title).toBe('Q · missed') // not "Q · missed · missed"
    const recent = await listRecentQuizzes(A.sb, 50)
    expect(recent.map(r => r.quiz.id)).toContain(twice.id)
    expect(recent.find(r => r.quiz.id === quizId)).toMatchObject({ attempts: 0, best: null })
  })
  it('allows a quiz of one to thirty questions, and no fewer or more', async () => {
    const { noteId } = await makeQuiz(A)
    const make = (n: number) => A.sb.from('quizzes').insert({ note_id: noteId, title: 'Size', questions: Array.from({ length: n }, (_, i) => ({ ...questions[0], id: `q${i}` })) })
    expect((await make(1)).error).toBeNull()
    expect((await make(30)).error).toBeNull()
    expect((await make(0)).error).not.toBeNull()
    expect((await make(31)).error).not.toBeNull()
  })
  it("is not possible on another student's note", async () => {
    const { noteId, quizId } = await makeQuiz(A)
    await expect(createRetryQuiz(B.sb, { id: quizId, note_id: noteId, title: 'Q', questions, created_at: '' } as never, questions as never)).rejects.toBeTruthy()
  })
})
