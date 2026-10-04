import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { markInstant, normalizeAnswer, scoreOf } from '@/lib/quiz/marking'
import type { Question } from '@/lib/quiz/types'

const mcq: Question = { id: 'q1', type: 'mcq', prompt: 'Where?', options: ['Cytoplasm', 'Matrix', 'Nucleus', 'Ribosome'], answer: 'Matrix', explanation: 'x' }
const tf: Question = { id: 'q2', type: 'true_false', prompt: 'T?', options: null, answer: 'true', explanation: 'x' }
const short: Question = { id: 'q3', type: 'short', prompt: 'Product?', options: null, answer: 'NADH', explanation: 'Made by the cycle.' }

describe('instant marking', () => {
  it('marks choices exactly, and short answers only when they match', () => {
    expect(markInstant(mcq, 'Matrix')).toBe(true)
    expect(markInstant(mcq, 'Nucleus')).toBe(false)
    expect(markInstant(tf, 'false')).toBe(false)
    expect(markInstant(short, '  nadh. ')).toBe(true)
    expect(markInstant(short, 'it makes NADH and FADH2')).toBeNull()
  })
  it('does not confuse options that differ only by punctuation', () => {
    const calc: Question = { id: 'q9', type: 'mcq', prompt: 'Derivative?', options: ['f(x)', "f'(x)", 'x', '(x)'], answer: "f'(x)", explanation: 'x' }
    expect(markInstant(calc, 'f(x)')).toBe(false)
    expect(markInstant(calc, "f'(x)")).toBe(true)
    expect(markInstant({ ...calc, answer: '(x)' }, 'x')).toBe(false)
  })
  it('normalises case, spacing and punctuation', () => {
    expect(normalizeAnswer('  The  Matrix! ')).toBe('the matrix')
  })
  it('scores answers', () => {
    expect(scoreOf({ q1: { given: 'a', correct: true, feedback: null }, q2: { given: 'b', correct: false, feedback: null } })).toBe(1)
  })
})

// ---- route ----
let user: { id: string } | null = { id: 'u1' }
let check = 'ok'
const adminRpc = vi.fn(async (...a: unknown[]) => ({ data: a[0] === 'ai_check' ? check : null, error: null }))
vi.mock('@/lib/supabase/admin', () => ({ adminClient: () => ({ rpc: adminRpc }) }))
const adminCalls = () => adminRpc.mock.calls.map(c => [c[0], (c[1] as { p_cost: number }).p_cost])
const attempt = { id: '22222222-2222-4222-8222-222222222222', quiz_id: 'qz', finished_at: null as string | null, quizzes: { questions: [mcq, tf, short] } }
const sb = {
  auth: { getUser: async () => ({ data: { user } }) },
  rpc: vi.fn(),
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: attempt, error: null }) }) }) }),
}
const parse = vi.fn()
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: async () => sb }))
vi.mock('@/lib/ai/openai', async orig => ({ ...(await orig<typeof import('@/lib/ai/openai')>()), openai: () => ({ responses: { parse } }) }))
import { POST } from '@/app/api/ai/quiz/mark/route'

const call = (body: object) => POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ attemptId: attempt.id, ...body }) }))
beforeEach(() => {
  user = { id: 'u1' }; check = 'ok'; attempt.finished_at = null; adminRpc.mockClear(); parse.mockReset()
  parse.mockResolvedValue({ status: 'completed', output: [], output_parsed: { correct: true, feedback: 'Yes, NADH.' } })
  process.env.OPENAI_API_KEY = 'k'
})
afterEach(() => { delete process.env.OPENAI_API_KEY })

describe('POST /api/ai/quiz/mark', () => {
  it('accepts an exact match without asking the AI', async () => {
    const res = await call({ questionId: 'q3', answer: 'nadh' })
    expect(await res.json()).toEqual({ correct: true, feedback: 'Made by the cycle.' })
    expect(parse).not.toHaveBeenCalled()
    expect(adminRpc).not.toHaveBeenCalled()
  })
  it('asks the AI for other answers, after the speed-limit check', async () => {
    const res = await call({ questionId: 'q3', answer: 'it produces NADH' })
    expect(await res.json()).toEqual({ correct: true, feedback: 'Yes, NADH.' })
    expect(adminCalls()).toEqual([['ai_check', 0]]) // free marking: speed-checked, never charged
  })
  it('refuses when going too fast, for finished attempts, and for non-short questions', async () => {
    check = 'rate_limited'
    expect((await call({ questionId: 'q3', answer: 'something else' })).status).toBe(429)
    check = 'ok'
    attempt.finished_at = 'yesterday'
    expect((await call({ questionId: 'q3', answer: 'something else' })).status).toBe(409)
    attempt.finished_at = null
    expect((await call({ questionId: 'q1', answer: 'Matrix' })).status).toBe(400)
    expect(parse).not.toHaveBeenCalled()
  })
  it('validates input', async () => {
    expect((await call({ questionId: 'q3', answer: 'x'.repeat(1001) })).status).toBe(400)
    user = null
    expect((await call({ questionId: 'q3', answer: 'x' })).status).toBe(401)
  })
})
