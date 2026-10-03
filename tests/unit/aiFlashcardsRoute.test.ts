import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const NOTE_ID = '11111111-1111-4111-8111-111111111111'
let note: { id: string; title: string; content_md: string } | null
const sb = {
  auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
  rpc: vi.fn(async (fn: string) => ({ data: fn === 'ai_request_allowed' ? true : null, error: null })),
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: note, error: null }) }) }) }),
}
const parse = vi.fn()
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: async () => sb }))
vi.mock('@/lib/ai/openai', async orig => ({ ...(await orig<typeof import('@/lib/ai/openai')>()), openai: () => ({ responses: { parse } }) }))
import { POST } from '@/app/api/ai/flashcards/route'

const call = () => POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ noteId: NOTE_ID }) }))
const fns = () => sb.rpc.mock.calls.map(c => c[0])
beforeEach(() => {
  note = { id: NOTE_ID, title: 'Krebs', content_md: 'The Krebs cycle happens in the matrix. '.repeat(3) }
  sb.rpc.mockClear(); parse.mockReset(); process.env.OPENAI_API_KEY = 'k'
})
afterEach(() => { delete process.env.OPENAI_API_KEY })

describe('POST /api/ai/flashcards', () => {
  it('returns cleaned cards', async () => {
    parse.mockResolvedValue({ status: 'completed', output: [], output_parsed: { cards: [{ front: ' Where? ', back: 'Matrix' }] } })
    const res = await call()
    expect(await res.json()).toEqual({ cards: [{ front: 'Where?', back: 'Matrix' }] })
    expect(fns()).toEqual(['ai_request_allowed'])
  })
  it('refuses very short notes without calling the AI', async () => {
    note = { id: NOTE_ID, title: 'x', content_md: 'Too short.' }
    const res = await call()
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: 'too_short' })
    expect(parse).not.toHaveBeenCalled()
  })
  it('says so when nothing usable comes back', async () => {
    parse.mockResolvedValue({ status: 'completed', output: [], output_parsed: { cards: [{ front: '', back: '' }] } })
    const res = await call()
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: 'empty' })
  })
})
