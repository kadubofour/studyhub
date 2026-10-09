import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const CHAT = '11111111-1111-4111-8111-111111111111', NOTE = '22222222-2222-4222-8222-222222222222'
const C1 = '33333333-3333-4333-8333-333333333333'
let reserve = 'ok'
const release = vi.fn(async () => {})
vi.mock('@/lib/ai/tutorLimit', () => ({ reserveTutorMessage: async () => reserve, releaseTutorMessage: () => release() }))
type Ev = { type: 'delta'; text: string } | { type: 'tool'; name: string; args: string }
let script: (Ev | Error)[] = []
const modelInput = vi.fn()
vi.mock('@/lib/ai/tutor', () => ({
  streamTutor: async function* (_c: unknown, o: unknown) { modelInput(o); for (const e of script) { if (e instanceof Error) throw e; yield e } },
}))
vi.mock('@/lib/ai/openai', async orig => ({ ...(await orig<typeof import('@/lib/ai/openai')>()), openai: () => ({}) }))

let user: { id: string } | null
let chat: Record<string, unknown> | null
let note: Record<string, unknown> | null
let matches: Record<string, unknown>[]
let history: Record<string, unknown>[]
let stats: Record<string, unknown>[] = []
let statsFail = false
const rpcCalls: [string, unknown][] = []
const inserted: [string, Record<string, unknown>][] = []
const updated: [string, Record<string, unknown>][] = []
let insertError: object | null = null
const result = (data: unknown) => {
  const q: Record<string, unknown> = {}
  for (const k of ['select', 'eq', 'order', 'limit']) q[k] = () => q
  q.maybeSingle = async () => ({ data: Array.isArray(data) ? (data[0] ?? null) : data, error: null })
  q.then = (res: (v: unknown) => unknown) => res({ data, error: null })
  return q
}
const sb = {
  auth: { getUser: async () => ({ data: { user } }) },
  rpc: (fn: string, args?: unknown) => {
    rpcCalls.push([fn, args])
    if (fn === 'topic_stats') return statsFail ? { then: (res: (v: unknown) => unknown) => res({ data: null, error: { message: 'boom' } }) } : result(stats)
    return result(fn === 'tutor_find_material' ? matches : null)
  },
  from: (table: string) => {
    if (table === 'tutor_chats') return { ...result(chat), update: (p: Record<string, unknown>) => { updated.push([table, p]); const r: Record<string, unknown> = { eq: () => r, then: (res: (v: unknown) => unknown) => res({ error: null }) }; return r } }
    if (table === 'notes') return result(note)
    if (table === 'courses') return result([{ id: C1, name: 'Biology' }])
    if (table === 'decks') return result([])
    if (table === 'tutor_messages') return {
      ...result(history),
      insert: (row: Record<string, unknown>) => {
        inserted.push([table, row])
        return { select: () => ({ single: async () => ({ data: insertError ? null : { id: `m${inserted.length}` }, error: insertError }) }) }
      },
    }
    return result(null)
  },
}
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: async () => sb }))
import { POST } from '@/app/api/ai/tutor/route'

const call = (body: object = {}) => POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ chatId: CHAT, message: 'Why NADH?', ...body }) }))
const lines = async (res: Response) => (await res.text()).trim().split('\n').map(l => JSON.parse(l) as Record<string, unknown>)
beforeEach(() => {
  user = { id: 'u1' }; reserve = 'ok'; release.mockClear(); modelInput.mockClear(); inserted.length = 0; updated.length = 0; insertError = null
  chat = { id: CHAT, title: 'New chat', course_id: null, note_id: NOTE, lecture_id: null }
  note = { id: NOTE, title: 'Krebs', content_md: 'The Krebs cycle runs in the matrix.' }
  stats = []; statsFail = false; rpcCalls.length = 0
  matches = []; history = []; script = [{ type: 'delta', text: 'NADH carries ' }, { type: 'delta', text: 'electrons.' }]
  process.env.OPENAI_API_KEY = 'k'
})
afterEach(() => { delete process.env.OPENAI_API_KEY })

describe('POST /api/ai/tutor', () => {
  it('streams the sources and the reply, and saves both messages', async () => {
    const res = await call()
    expect(res.headers.get('content-type')).toContain('application/x-ndjson')
    const out = await lines(res)
    expect(out[0]).toEqual({ t: 'sources', sources: [{ kind: 'note', id: NOTE, title: 'Krebs' }] })
    expect(out.filter(l => l.t === 'delta').map(l => l.text).join('')).toBe('NADH carries electrons.')
    expect(out.at(-1)).toMatchObject({ t: 'done', proposals: [] })
    expect(inserted.map(([, r]) => [r.role, r.content])).toEqual([['user', 'Why NADH?'], ['assistant', 'NADH carries electrons.']])
    expect(inserted[1][1]).toMatchObject({ status: 'ok', sources: [{ kind: 'note', id: NOTE, title: 'Krebs' }] })
    expect(release).not.toHaveBeenCalled()
  })
  it('gives the model the attached note, the student\'s message and the quiz tool', async () => {
    await (await call()).text()
    const o = modelInput.mock.calls[0][0] as { input: { content: string }[]; tools: { name: string }[] }
    expect(o.input.at(-1)!.content).toContain('The Krebs cycle runs in the matrix.')
    expect(o.input.at(-1)!.content).toContain('Why NADH?')
    expect(o.tools.map(t => t.name)).toContain('create_quiz')
  })
  it('names the chat after the first message', async () => {
    await (await call({ message: 'Explain the electron transport chain' })).text()
    expect(updated[0][1]).toEqual({ title: 'Explain the electron transport chain' })
  })
  it('turns valid tool calls into proposals and drops invalid ones, saying so', async () => {
    script = [
      { type: 'delta', text: 'Here you go.' },
      { type: 'tool', name: 'create_flashcards', args: JSON.stringify({ deck_name: 'Krebs', cards: [{ front: 'Q', back: 'A' }] }) },
      { type: 'tool', name: 'create_note', args: JSON.stringify({ title: 'x', body: 'y', course_id: '99999999-9999-4999-8999-999999999999' }) },
    ]
    const out = await lines(await call())
    const done = out.at(-1) as { proposals: { tool: string; state: string }[] }
    expect(done.proposals.map(p => [p.tool, p.state])).toEqual([['create_flashcards', 'pending']])
    expect(out.filter(l => l.t === 'delta').map(l => l.text).join('')).toMatch(/couldn't prepare/)
    expect(inserted[1][1].proposals).toHaveLength(1)
  })
  it('is refused before anything is saved when the limit is reached', async () => {
    reserve = 'tutor_limit'
    const res = await call()
    expect(res.status).toBe(402)
    expect(await res.json()).toEqual({ error: 'tutor_limit' })
    expect(inserted).toHaveLength(0)
    expect(modelInput).not.toHaveBeenCalled()
  })
  it('gives the message back when the model fails before saying anything; the student\'s message is kept', async () => {
    script = [new Error('boom')]
    const res = await call()
    expect(res.status).toBe(502)
    expect(release).toHaveBeenCalledTimes(1)
    expect(inserted.map(([, r]) => r.role)).toEqual(['user'])
  })
  it('keeps the partial reply as cut off when the stream breaks after some text', async () => {
    script = [{ type: 'delta', text: 'NADH carries ' }, new Error('network')]
    const out = await lines(await call())
    expect(out.at(-1)).toMatchObject({ t: 'error', error: 'ai_failed', messageId: expect.any(String) })
    expect(inserted[1][1]).toMatchObject({ role: 'assistant', content: 'NADH carries ', status: 'cut_off' })
    expect(release).not.toHaveBeenCalled()
  })
  it('rejects a missing or oversize message, a bad chat id, no sign-in and an unknown chat', async () => {
    expect((await call({ message: '   ' })).status).toBe(400)
    expect((await call({ message: 'x'.repeat(4001) })).status).toBe(400)
    expect((await call({ chatId: 'nope' })).status).toBe(400)
    chat = null
    expect((await call()).status).toBe(404)
    user = null
    expect((await call()).status).toBe(401)
    expect(reserve).toBe('ok')
  })
  it('says AI is unavailable without an OpenAI key', async () => {
    delete process.env.OPENAI_API_KEY
    expect((await call()).status).toBe(503)
    expect(inserted).toHaveLength(0)
  })
  it('caps a huge attached note', async () => {
    note = { id: NOTE, title: 'Huge', content_md: 'word '.repeat(200_000) }
    await (await call()).text()
    const o = modelInput.mock.calls[0][0] as { input: { content: string }[] }
    expect(o.input.at(-1)!.content.length).toBeLessThan(40_000)
  })
  it('does not overwrite a title the student has set, or changed while the reply was written', async () => {
    chat = { ...chat, title: 'My own name' }
    await (await call()).text()
    expect(updated.every(([, patch]) => !('title' in patch))).toBe(true)
    expect(updated.length).toBeGreaterThan(0) // the chat is still touched, so it moves to the top of the list
  })
  const topicStat = (over: Record<string, unknown> = {}) => ({
    topic_id: 't1', name: 'Krebs cycle', position: 1, answers_30d: 12, correct_30d: 8, answers_all: 12, last_practised: new Date().toISOString(),
    notes: 1, lectures: 0, decks: 0, status: 'weak', ...over,
  })
  const modelText = () => (modelInput.mock.calls[0][0] as { input: { content: string }[] }).input.at(-1)!.content

  it('tells the tutor the weak topics of the chat\'s course', async () => {
    chat = { ...chat, course_id: 'c1' }
    stats = [topicStat(), topicStat({ topic_id: 't2', name: 'Glycolysis', status: 'mastered', answers_30d: 10, correct_30d: 10 })]
    await (await call()).text()
    expect(rpcCalls).toContainEqual(['topic_stats', { p_course: 'c1' }])
    expect(modelText()).toContain('<weak_topics>\n- Krebs cycle: 12 answers, 67% right in the last 30 days\n</weak_topics>')
    expect(modelText()).not.toContain('Glycolysis')
  })
  it('includes a topic not practised for a while', async () => {
    chat = { ...chat, course_id: 'c1' }
    stats = [topicStat({ name: 'Old topic', status: 'covered', answers_30d: 0, correct_30d: 0, answers_all: 4, last_practised: '2026-01-01T00:00:00Z' })]
    await (await call()).text()
    expect(modelText()).toContain('- Old topic: Not practised in the last 30 days')
  })
  it('finds the course through the attached note', async () => {
    note = { id: NOTE, title: 'Krebs', content_md: 'The Krebs cycle runs in the matrix.', course_id: 'c9' }
    stats = [topicStat()]
    await (await call()).text()
    expect(rpcCalls).toContainEqual(['topic_stats', { p_course: 'c9' }])
    expect(modelText()).toContain('<weak_topics>')
  })
  it('does not look anything up for a chat with no course', async () => {
    await (await call()).text()
    expect(rpcCalls.some(([fn]) => fn === 'topic_stats')).toBe(false)
    expect(modelText()).not.toContain('weak_topics')
  })
  it('answers as before when the lookup fails', async () => {
    chat = { ...chat, course_id: 'c1' }
    statsFail = true
    const out = await lines(await call())
    expect(out.at(-1)).toMatchObject({ t: 'done' })
    expect(modelText()).not.toContain('weak_topics')
  })
})
