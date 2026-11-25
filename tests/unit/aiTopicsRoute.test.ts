import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const COURSE = '11111111-1111-4111-8111-111111111111'
const N1 = '22222222-2222-4222-8222-222222222222', N2 = '33333333-3333-4333-8333-333333333333', L1 = '44444444-4444-4444-8444-444444444444'
let check = 'ok'
const adminRpc = vi.fn(async (...a: unknown[]) => ({ data: a[0] === 'ai_check' ? check : null, error: null }))
vi.mock('@/lib/supabase/admin', () => ({ adminClient: () => ({ rpc: adminRpc }) }))
let user: { id: string } | null
let course: object | null
let notes: object[], lectures: object[], topics: object[], links: object[], files: object[]
const result = (data: unknown) => {
  const q: Record<string, unknown> = {}
  for (const k of ['select', 'eq', 'is', 'order', 'limit']) q[k] = () => q
  q.maybeSingle = async () => ({ data: Array.isArray(data) ? (data[0] ?? null) : data, error: null })
  q.then = (res: (v: unknown) => unknown) => res({ data, error: null })
  return q
}
const sb = {
  auth: { getUser: async () => ({ data: { user } }) },
  from: (t: string) => result(t === 'courses' ? course : t === 'notes' ? notes : t === 'lectures' ? lectures : t === 'topics' ? topics : t === 'materials' ? files : links),
}
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: async () => sb }))
const parse = vi.fn()
vi.mock('@/lib/ai/openai', async orig => ({ ...(await orig<typeof import('@/lib/ai/openai')>()), openai: () => ({ responses: { parse } }) }))
import { POST } from '@/app/api/ai/topics/route'

const TEXT = 'The Krebs cycle runs in the mitochondrial matrix and makes NADH and FADH2 for the chain.'
const call = (body: object = {}) => POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ courseId: COURSE, mode: 'draft', ...body }) }))
const fns = () => adminRpc.mock.calls.map(c => c[0])
beforeEach(() => {
  files = []; user = { id: 'u1' }; course = { id: COURSE }; check = 'ok'; adminRpc.mockClear(); parse.mockReset(); process.env.OPENAI_API_KEY = 'k'
  notes = [{ id: N1, title: 'Krebs', content_md: TEXT, updated_at: '2026-10-02T00:00:00Z' }, { id: N2, title: 'Glyco', content_md: TEXT, updated_at: '2026-10-01T00:00:00Z' }]
  lectures = [{ id: L1, title: 'Bio', transcript: [{ start: 0, end: 5, text: TEXT }], recorded_at: '2026-10-03T00:00:00Z' }]
  topics = []; links = []
  parse.mockResolvedValue({ status: 'completed', output: [], output_parsed: { topics: [{ name: 'Krebs cycle', notes: [N1, N2], lectures: [L1], files: [] }] } })
})
afterEach(() => { delete process.env.OPENAI_API_KEY })

describe('POST /api/ai/topics', () => {
  it('drafts topics from the course\'s notes and lectures, and saves nothing', async () => {
    const res = await call()
    expect(await res.json()).toEqual({ topics: [{ name: 'Krebs cycle', notes: [N1, N2], lectures: [L1] }] })
    expect(fns()).toEqual(['ai_check']) // one action, no release
    const input = (parse.mock.calls[0][0] as { input: { content: string }[] }).input[0].content
    expect(input).toContain(`<note id="${N1}"`)
    expect(input).toContain(`<lecture id="${L1}"`)
  })
  it('reads an uploaded file with no note made from it along with the notes, and can link a topic to it', async () => {
    const F1 = '55555555-5555-4555-8555-555555555555'
    files = [{ id: F1, course_id: COURSE, note_id: null, name: 'Sets slides.pdf', mime: 'application/pdf', path: 'u1/x.pdf', bytes: 10, body: TEXT, body_status: 'ready', created_at: '2026-10-03T00:00:00Z' }]
    parse.mockResolvedValue({ status: 'completed', output: [], output_parsed: { topics: [{ name: 'Sets', notes: [], lectures: [], files: [F1] }] } })
    const res = await call()
    expect(await res.json()).toEqual({ topics: [{ name: 'Sets', notes: [], lectures: [], files: [F1] }] })
    expect((parse.mock.calls[0][0] as { input: { content: string }[] }).input[0].content).toContain(`<file id="${F1}" title="Sets slides.pdf">`)
  })
  it('a course with one note and one readable file has enough to draft from', async () => {
    notes = [notes[0]]; lectures = []
    files = [{ id: '55555555-5555-4555-8555-555555555555', course_id: COURSE, note_id: null, name: 'Sets slides.pdf', body: TEXT, body_status: 'ready', created_at: '2026-10-03T00:00:00Z' }]
    expect((await call()).status).toBe(200)
  })
  it('needs at least two notes or lectures with real text, and charges nothing for that', async () => {
    notes = [notes[0]]; lectures = []
    const res = await call()
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: 'too_little' })
    expect(fns()).toEqual([])
    expect(parse).not.toHaveBeenCalled()
  })
  it('update mode sends only what is not linked yet, with the existing topics', async () => {
    topics = [{ id: 't1', name: 'Krebs cycle' }]; links = [{ note_id: N1, lecture_id: null }, { note_id: N2, lecture_id: null }]
    await call({ mode: 'update' })
    const input = (parse.mock.calls[0][0] as { input: { content: string }[] }).input[0].content
    expect(input).toContain('- Krebs cycle')
    expect(input).toContain(`<lecture id="${L1}"`)
    expect(input).not.toContain(`<note id="${N1}"`)
  })
  it('update mode with everything already linked says so, with no charge', async () => {
    topics = [{ id: 't1', name: 'Krebs cycle' }]; links = [{ note_id: N1, lecture_id: null }, { note_id: N2, lecture_id: null }, { note_id: null, lecture_id: L1 }]
    const res = await call({ mode: 'update' })
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: 'nothing_new' })
    expect(fns()).toEqual([])
  })
  it('gives the action back when nothing usable came back', async () => {
    parse.mockResolvedValue({ status: 'completed', output: [], output_parsed: { topics: [{ name: 'Invented', notes: ['zzz'], lectures: [], files: [] }] } })
    const res = await call()
    expect(await res.json()).toEqual({ error: 'empty' })
    expect(fns()).toEqual(['ai_check', 'ai_release'])
  })
  it('passes the plan limits through', async () => {
    check = 'daily_limit'
    const res = await call()
    expect(res.status).toBe(402)
    expect(parse).not.toHaveBeenCalled()
  })
  it('rejects a bad request, no sign-in, and a course that is not the student\'s', async () => {
    expect((await call({ courseId: 'nope' })).status).toBe(400)
    expect((await call({ mode: 'other' })).status).toBe(400)
    course = null
    expect((await call()).status).toBe(404)
    user = null
    expect((await call()).status).toBe(401)
  })
})
