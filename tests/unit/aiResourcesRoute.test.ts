import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const TOPIC = '11111111-1111-4111-8111-111111111111'
let check = 'ok'
const adminRpc = vi.fn(async (...a: unknown[]) => ({ data: a[0] === 'ai_check' ? check : null, error: null }))
vi.mock('@/lib/supabase/admin', () => ({ adminClient: () => ({ rpc: adminRpc }) }))
let user: { id: string } | null
let topic: object | null
const q = (data: unknown) => { const o: Record<string, unknown> = {}; for (const k of ['select', 'eq']) o[k] = () => o; o.maybeSingle = async () => ({ data, error: null }); return o }
const sb = { auth: { getUser: async () => ({ data: { user } }) }, from: () => q(topic) }
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: async () => sb }))
const create = vi.fn()
vi.mock('@/lib/ai/openai', async orig => ({ ...(await orig<typeof import('@/lib/ai/openai')>()), openai: () => ({ responses: { create } }) }))
import { POST } from '@/app/api/ai/resources/route'

const call = (body: object = { topicId: TOPIC }) => POST(new Request('http://x', { method: 'POST', body: JSON.stringify(body) }))
const fns = () => adminRpc.mock.calls.map(c => c[0])
const cited = (...urls: string[]) => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'x', annotations: urls.map(url => ({ type: 'url_citation', url, title: url })) }] }] })
beforeEach(() => {
  user = { id: 'u1' }; topic = { id: TOPIC, name: 'Krebs cycle', courses: { name: 'Biology' } }; check = 'ok'
  adminRpc.mockClear(); create.mockReset(); process.env.OPENAI_API_KEY = 'k'
  create.mockResolvedValue(cited('https://youtu.be/x', 'https://a.test/b'))
})
afterEach(() => { delete process.env.OPENAI_API_KEY })

describe('POST /api/ai/resources', () => {
  it('returns the cited links and charges one action', async () => {
    const res = await call()
    expect(res.status).toBe(200)
    expect((await res.json()).resources.map((r: { kind: string }) => r.kind)).toEqual(['video', 'article'])
    expect(adminRpc).toHaveBeenCalledWith('ai_check', { p_user: 'u1', p_cost: 1 })
  })
  it('asks the search about the topic and course names only', async () => {
    await call()
    const input = (create.mock.calls[0][0] as { input: string }).input
    expect(input).toContain('Krebs cycle')
    expect(input).toContain('Biology')
  })
  it('needs sign-in, a real topic id, and one of the student\'s own topics', async () => {
    user = null
    expect((await call()).status).toBe(401)
    user = { id: 'u1' }
    expect((await call({ topicId: 'nope' })).status).toBe(400)
    expect((await call({})).status).toBe(400)
    topic = null
    expect((await call()).status).toBe(404)
    expect(create).not.toHaveBeenCalled()
    expect(fns()).not.toContain('ai_check')
  })
  it('gives the action back and says so when nothing usable was found', async () => {
    create.mockResolvedValue(cited())
    const res = await call()
    expect(res.status).toBe(422)
    expect((await res.json()).error).toBe('empty')
    expect(fns()).toContain('ai_release')
  })
  it('passes on the plan limit without searching', async () => {
    check = 'daily_limit'
    expect((await call()).status).toBe(402)
    expect(create).not.toHaveBeenCalled()
  })
})
