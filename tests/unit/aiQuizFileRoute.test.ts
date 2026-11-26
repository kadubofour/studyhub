import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const FILE_ID = '55555555-5555-4555-8555-555555555555'
let file: Record<string, unknown> | null
let check = 'ok'
const adminRpc = vi.fn(async (...a: unknown[]) => ({ data: a[0] === 'ai_check' ? check : null, error: null }))
vi.mock('@/lib/supabase/admin', () => ({ adminClient: () => ({ rpc: adminRpc }) }))
const inserted: Record<string, unknown>[] = []
const updates: unknown[] = []
const sb = {
  auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
  storage: { from: () => ({ download: async () => ({ data: null }) }) },
  from: (table: string) => table === 'materials'
    ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: file, error: null }) }) }), update: (v: unknown) => { updates.push(v); return { eq: async () => ({}) } } }
    : { insert: (row: Record<string, unknown>) => { inserted.push(row); return { select: () => ({ single: async () => ({ data: { id: 'qz1', created_at: 'now', ...row }, error: null }) }) } } },
}
const parse = vi.fn()
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: async () => sb }))
vi.mock('@/lib/ai/openai', async orig => ({ ...(await orig<typeof import('@/lib/ai/openai')>()), openai: () => ({ responses: { parse } }) }))
import { POST } from '@/app/api/ai/quiz/route'

const TEXT = 'A set is a collection of distinct objects, and the union of two sets holds everything in either. '.repeat(6)
const mcq = (prompt: string) => ({ type: 'mcq', prompt, options: ['a', 'b', 'c', 'd'], answer: 'b', explanation: 'x', full_answer: '' })
const call = (body: object = {}) => POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ materialId: FILE_ID, count: 5, types: ['mcq'], ...body }) }))
beforeEach(() => {
  file = { id: FILE_ID, course_id: 'c1', note_id: null, name: 'Sets slides.pdf', mime: 'application/pdf', path: 'u1/a.pdf', bytes: 10, body: TEXT, body_status: 'ready', created_at: 'x' }
  inserted.length = 0; updates.length = 0; adminRpc.mockClear(); check = 'ok'; parse.mockReset(); process.env.OPENAI_API_KEY = 'k'
  parse.mockResolvedValue({ status: 'completed', output: [], output_parsed: { title: 'Sets quiz', questions: [mcq('A'), mcq('B'), mcq('C')] } })
})
afterEach(() => { delete process.env.OPENAI_API_KEY })

describe('POST /api/ai/quiz from an uploaded file', () => {
  it('writes the quiz from the file\'s text and saves it against the file, with no note', async () => {
    const res = await call()
    expect(res.status).toBe(200)
    expect(inserted).toHaveLength(1)
    expect(inserted[0]).toMatchObject({ note_id: null, material_id: FILE_ID, title: 'Sets quiz' })
    expect(JSON.stringify((parse.mock.calls[0][0] as { input: unknown }).input)).toContain('A set is a collection of distinct objects')
    expect(adminRpc.mock.calls.map(c => c[0])).toEqual(['ai_check']) // one action, no release
  })
  it('refuses a file with no text in it (a scan or a photo), and charges nothing', async () => {
    file = { ...file!, body: null, body_status: 'no_text' }
    const res = await call()
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: 'too_short' })
    expect(adminRpc).not.toHaveBeenCalled()
  })
  it('says not found for a file that is not the student\'s', async () => {
    file = null
    expect((await call()).status).toBe(404)
  })
  it('rejects a bad id, a bad count and bad types', async () => {
    expect((await call({ materialId: 'nope' })).status).toBe(400)
    expect((await call({ count: 7 })).status).toBe(400)
    expect((await call({ types: [] })).status).toBe(400)
    expect(parse).not.toHaveBeenCalled()
  })
})
