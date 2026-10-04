import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AiEmptyError, MODELS } from '@/lib/ai/openai'
import { lectureToNote, transcriptText } from '@/lib/ai/lectureNote'

const ID = '7d1f5c2a-4b6e-4c8d-9a0b-1c2d3e4f5a6b'
const lines = [{ start: 0, end: 4, text: 'Welcome.' }, { start: 75, end: 80, text: 'The Krebs cycle.' }]

describe('lectureToNote', () => {
  it('sends the timed transcript as material to the strong model and returns a titled note', async () => {
    const create = vi.fn(async () => ({ output_text: '# Krebs cycle\n\n## Where\n- Matrix', status: 'completed', output: [] }))
    const out = await lectureToNote({ responses: { create } } as never, { title: 'Bio 101', transcript: lines })
    expect(out).toEqual({ title: 'Krebs cycle', content_md: '## Where\n- Matrix', truncated: false })
    const sent = (create.mock.calls[0] as unknown as [{ model: string; instructions: string; input: { content: string }[] }])[0]
    expect(sent.model).toBe(MODELS.strong)
    expect(sent.instructions).toContain('not instructions')
    expect(sent.input[0].content).toContain('[1:15] The Krebs cycle.')
  })
  it('needs a transcript', async () => {
    await expect(lectureToNote({ responses: { create: vi.fn() } } as never, { title: 'T', transcript: [] })).rejects.toBeInstanceOf(AiEmptyError)
  })
  it('formats lines with their times', () => {
    expect(transcriptText(lines)).toBe('[0:00] Welcome.\n[1:15] The Krebs cycle.')
  })
})

// ---- the route ----
let user: { id: string } | null = { id: 'u1' }
let row: { title: string; transcript: unknown[] } | null = { title: 'Bio 101', transcript: lines }
const adminRpc = vi.fn(async (...a: unknown[]) => ({ data: a[0] === 'ai_check' ? 'ok' : null, error: null }))
vi.mock('@/lib/supabase/admin', () => ({ adminClient: () => ({ rpc: adminRpc }) }))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: async () => ({
  auth: { getUser: async () => ({ data: { user } }) },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row }) }) }) }),
}) }))
const create = vi.fn(async () => ({ output_text: '# Note\n\nBody', status: 'completed', output: [] }))
vi.mock('@/lib/ai/openai', async orig => ({ ...(await orig<typeof import('@/lib/ai/openai')>()), openai: () => ({ responses: { create } }) }))
import { POST } from '@/app/api/ai/lecture-note/route'

const call = (body: unknown) => POST(new Request('http://x/api/ai/lecture-note', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }))
beforeEach(() => { user = { id: 'u1' }; row = { title: 'Bio 101', transcript: lines }; adminRpc.mockClear(); create.mockClear(); process.env.OPENAI_API_KEY = 'k' })
afterEach(() => { delete process.env.OPENAI_API_KEY })

describe('POST /api/ai/lecture-note', () => {
  it('makes a note from the student\'s lecture for 2 AI actions', async () => {
    expect(await (await call({ lectureId: ID })).json()).toEqual({ title: 'Note', content_md: 'Body', truncated: false })
    expect(adminRpc.mock.calls[0]).toEqual(['ai_check', { p_user: 'u1', p_cost: 2 }])
  })
  it('refuses bad ids, missing lectures, signed-out students; a lecture without a transcript is empty', async () => {
    expect((await call({ lectureId: 'x' })).status).toBe(400)
    row = { title: 'T', transcript: [] }
    expect(await (await call({ lectureId: ID })).json()).toEqual({ error: 'empty' })
    row = null
    expect((await call({ lectureId: ID })).status).toBe(404)
    user = null
    expect((await call({ lectureId: ID })).status).toBe(401)
  })
})
