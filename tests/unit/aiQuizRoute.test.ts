import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const NOTE_ID = '11111111-1111-4111-8111-111111111111'
let note: { id: string; title: string; content_md: string } | null
let insertError: object | null = null
const inserted: unknown[] = []
const sb = {
  auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
  rpc: vi.fn(async (fn: string) => ({ data: fn === 'ai_request_allowed' ? true : null, error: null })),
  from: (table: string) => table === 'notes'
    ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: note, error: null }) }) }) }
    : { insert: (row: Record<string, unknown>) => { inserted.push(row); return { select: () => ({ single: async () => (
        insertError ? { data: null, error: insertError } : { data: { id: 'qz1', created_at: 'now', ...row }, error: null }) }) } } },
}
const parse = vi.fn()
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: async () => sb }))
vi.mock('@/lib/ai/openai', async orig => ({ ...(await orig<typeof import('@/lib/ai/openai')>()), openai: () => ({ responses: { parse } }) }))
import { POST } from '@/app/api/ai/quiz/route'

const mcq = (prompt: string) => ({ type: 'mcq', prompt, options: ['a', 'b', 'c', 'd'], answer: 'b', explanation: 'x' })
const call = (body: object = {}) => POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ noteId: NOTE_ID, count: 5, types: ['mcq'], ...body }) }))
const fns = () => sb.rpc.mock.calls.map(c => c[0])
beforeEach(() => {
  note = { id: NOTE_ID, title: 'Krebs', content_md: 'The Krebs cycle happens in the matrix. '.repeat(8) }
  insertError = null; inserted.length = 0; sb.rpc.mockClear(); parse.mockReset(); process.env.OPENAI_API_KEY = 'k'
  parse.mockResolvedValue({ status: 'completed', output: [], output_parsed: { title: 'Krebs quiz', questions: [mcq('A'), mcq('B'), mcq('C')] } })
})
afterEach(() => { delete process.env.OPENAI_API_KEY })

describe('POST /api/ai/quiz', () => {
  it('saves the quiz and returns it', async () => {
    const res = await call()
    const quiz = await res.json() as { id: string; note_id: string; questions: { id: string }[] }
    expect(quiz.id).toBe('qz1')
    expect(quiz.note_id).toBe(NOTE_ID)
    expect(quiz.questions.map(q => q.id)).toEqual(['q1', 'q2', 'q3'])
    expect(fns()).toEqual(['ai_request_allowed'])
  })
  it('rejects bad counts and types', async () => {
    expect((await call({ count: 7 })).status).toBe(400)
    expect((await call({ types: [] })).status).toBe(400)
    expect((await call({ types: ['essay'] })).status).toBe(400)
    expect(parse).not.toHaveBeenCalled()
  })
  it('refuses short notes', async () => {
    note = { id: NOTE_ID, title: 'x', content_md: 'Too short.' }
    expect(await (await call()).json()).toEqual({ error: 'too_short' })
  })
  it('says so when fewer than 3 questions are usable, and saves nothing', async () => {
    parse.mockResolvedValue({ status: 'completed', output: [], output_parsed: { title: 'x', questions: [mcq('A')] } })
    const res = await call()
    expect(await res.json()).toEqual({ error: 'empty' })
    expect(inserted).toHaveLength(0)
  })
  it('reports ai_failed when the quiz cannot be saved', async () => {
    insertError = { message: 'db down' }
    expect((await call()).status).toBe(502)
  })
})
