import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const NOTE_ID = '11111111-1111-4111-8111-111111111111'
let user: { id: string } | null = { id: 'u1' }
let note: { id: string; title: string; content_md: string } | null
let check = 'ok'
const adminRpc = vi.fn(async (...a: unknown[]) => ({ data: a[0] === 'ai_check' ? check : null, error: null }))
vi.mock('@/lib/supabase/admin', () => ({ adminClient: () => ({ rpc: adminRpc }) }))
const adminCalls = () => adminRpc.mock.calls.map(c => [c[0], (c[1] as { p_cost: number }).p_cost])
const sb = {
  auth: { getUser: async () => ({ data: { user } }) },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: note, error: null }) }) }) }),
}
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: async () => sb }))
vi.mock('@/lib/ai/openai', async orig => ({ ...(await orig<typeof import('@/lib/ai/openai')>()), openai: () => fakeClient }))
const parse = vi.fn()
const fakeClient = { responses: { parse } }

import { POST } from '@/app/api/ai/summary/route'
import { summariseNote } from '@/lib/ai/summary'

const long = 'The Krebs cycle '.repeat(20)
const call = (body: unknown) => POST(new Request('http://x/api/ai/summary', { method: 'POST', body: JSON.stringify(body) }))

beforeEach(() => {
  user = { id: 'u1' }; check = 'ok'; note = { id: NOTE_ID, title: 'Krebs', content_md: long }
  adminRpc.mockClear(); parse.mockReset()
  parse.mockResolvedValue({ status: 'completed', output: [], output_parsed: { summary_md: '  Makes NADH.  ' } })
  process.env.OPENAI_API_KEY = 'k'
})
afterEach(() => { delete process.env.OPENAI_API_KEY })

describe('summariseNote', () => {
  it('uses the light model, quotes the note, and leaves out an existing summary', async () => {
    const out = await summariseNote(fakeClient as never, { title: 'Krebs', content_md: '> **Summary**\n>\n> Old one\n\n' + long })
    expect(out).toEqual({ summary_md: 'Makes NADH.' })
    const params = parse.mock.calls[0][0] as { model: string; input: { content: string }[]; instructions: string }
    expect(params.model).toBe('gpt-6-luna')
    expect(params.input[0].content).toContain('<note title="Krebs">')
    expect(params.input[0].content).not.toContain('Old one')
    expect(params.instructions).toMatch(/150 words/)
  })
})

describe('POST /api/ai/summary', () => {
  it('returns the summary after one speed-limit check', async () => {
    const res = await call({ noteId: NOTE_ID })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ summary_md: 'Makes NADH.' })
    expect(adminCalls()).toEqual([['ai_check', 1], ['ai_charge', 1]])
  })
  it('says to slow down when the speed limit is hit', async () => {
    check = 'rate_limited'
    const res = await call({ noteId: NOTE_ID })
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'rate_limited' })
    expect(parse).not.toHaveBeenCalled()
  })
  it('tells a Free student they have used today\'s actions (402), without calling the AI', async () => {
    check = 'daily_limit'
    const res = await call({ noteId: NOTE_ID })
    expect(res.status).toBe(402)
    expect(await res.json()).toEqual({ error: 'daily_limit' })
    expect(parse).not.toHaveBeenCalled()
  })
  it('refuses notes too short to summarise, without calling the AI', async () => {
    note = { id: NOTE_ID, title: 'x', content_md: 'Just a few words here.' }
    const res = await call({ noteId: NOTE_ID })
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: 'too_short' })
    expect(parse).not.toHaveBeenCalled()
  })
  it('rejects bad ids, missing notes and signed-out students', async () => {
    expect((await call({ noteId: 'nope' })).status).toBe(400)
    note = null
    expect((await call({ noteId: NOTE_ID })).status).toBe(404)
    user = null
    expect((await call({ noteId: NOTE_ID })).status).toBe(401)
  })
})
