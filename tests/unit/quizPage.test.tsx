// @vitest-environment jsdom
import { StrictMode } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, cleanup } from '@testing-library/react'

const quiz = { id: 'q1', note_id: 'n1', title: 'Quiz', questions: [] }
let open: unknown = null
const started: unknown[] = []
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'q1' }), useRouter: () => ({ replace: vi.fn() }) }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/quizzes', () => ({
  getQuiz: async () => quiz,
  getOpenAttempt: async () => { const seen = open; await new Promise(r => setTimeout(r, 5)); return seen },
  startAttempt: async () => { const a = { id: `a${started.length + 1}`, quiz_id: 'q1', answers: {}, finished_at: null }; started.push(a); open = a; return a },
  latestFinishedAttempt: async () => null,
}))
vi.mock('@/components/quiz/QuizPlayer', () => ({ QuizPlayer: () => null }))
vi.mock('@/components/quiz/QuizResults', () => ({ QuizResults: () => null }))
import QuizPage from '@/app/(app)/quiz/[id]/page'

beforeEach(() => { open = null; started.length = 0 })
afterEach(cleanup)

describe('quiz page', () => {
  it('starts one attempt even when the page effect runs twice (React strict mode)', async () => {
    await act(async () => { render(<StrictMode><QuizPage /></StrictMode>) })
    await act(async () => { await new Promise(r => setTimeout(r, 30)) })
    expect(started).toHaveLength(1)
  })
})
