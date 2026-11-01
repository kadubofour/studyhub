import { describe, it, expect, vi, beforeEach } from 'vitest'

let check = 'ok'
const adminRpc = vi.fn(async (...a: unknown[]) => ({ data: a[0] === 'ai_check' ? check : null, error: null }))
vi.mock('@/lib/supabase/admin', () => ({ adminClient: () => ({ rpc: adminRpc }) }))
let user: { id: string } | null
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) }))
const parse = vi.fn()
vi.mock('@/lib/ai/openai', async orig => ({ ...(await orig<typeof import('@/lib/ai/openai')>()), openai: () => ({ responses: { parse } }), isAiConfigured: () => true }))
import { POST as courses } from '@/app/api/ai/programme-courses/route'
import { POST as material } from '@/app/api/ai/starter-material/route'

const post = (fn: typeof courses, body: object) => fn(new Request('http://x', { method: 'POST', body: JSON.stringify(body) }))
const NOTE = 'Cells are the basic unit of life. They take in nutrients, make energy and copy themselves. Membranes keep the inside apart.'
beforeEach(() => { user = { id: 'u1' }; check = 'ok'; adminRpc.mockClear(); parse.mockReset() })

describe('POST /api/ai/programme-courses', () => {
  it('needs a signed-in student and a programme', async () => {
    user = null
    expect((await post(courses, { programme: 'BSc Biology' })).status).toBe(401)
    user = { id: 'u1' }
    expect((await post(courses, { programme: ' ' })).status).toBe(400)
    expect(parse).not.toHaveBeenCalled()
  })
  it('returns the suggested courses and reserves one AI action', async () => {
    parse.mockResolvedValue({ status: 'completed', output: [], output_parsed: { courses: [{ name: 'Cell Biology' }] } })
    const res = await post(courses, { programme: 'BSc Biology', year: 'Year 1' })
    expect(await res.json()).toEqual({ courses: ['Cell Biology'] })
    expect(adminRpc).toHaveBeenCalledWith('ai_check', { p_user: 'u1', p_cost: 1 })
  })
  it('stops at the daily limit without calling the AI', async () => {
    check = 'daily_limit'
    const res = await post(courses, { programme: 'BSc Biology' })
    expect(res.status).toBe(402)
    expect(parse).not.toHaveBeenCalled()
  })
})

describe('POST /api/ai/starter-material', () => {
  it('needs a course, then returns topics with their notes', async () => {
    expect((await post(material, { programme: 'BSc Biology' })).status).toBe(400)
    parse.mockResolvedValue({ status: 'completed', output: [], output_parsed: { topics: ['A', 'B', 'C'].map(name => ({ name, note_md: NOTE })) } })
    const res = await post(material, { course: 'Cell Biology', programme: 'BSc Biology' })
    const out = await res.json() as { topics: { name: string; note_md: string }[] }
    expect(out.topics.map(t => t.name)).toEqual(['A', 'B', 'C'])
    expect(out.topics[0].note_md).toContain('Starter note drafted by the AI')
  })
  it('gives the action back when the AI fails', async () => {
    parse.mockRejectedValue(new Error('boom'))
    const res = await post(material, { course: 'Cell Biology' })
    expect(res.status).toBe(502)
    expect(adminRpc).toHaveBeenCalledWith('ai_release', { p_user: 'u1', p_cost: 1 })
  })
})
