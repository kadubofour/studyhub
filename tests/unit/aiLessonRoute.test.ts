import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const CHAT = '11111111-1111-4111-8111-111111111111'
const REPLY = '22222222-2222-4222-8222-222222222222'
const USER_MSG = '33333333-3333-4333-8333-333333333333'
let messages: { id: string; role: string; content: string; created_at: string }[]
let chat: { id: string; title: string } | null
let check = 'ok'
let uploadFails = false
const adminRpc = vi.fn(async (...a: unknown[]) => ({ data: a[0] === 'ai_check' ? check : null, error: null }))
vi.mock('@/lib/supabase/admin', () => ({ adminClient: () => ({ rpc: adminRpc }) }))
const upload = vi.fn(async (..._a: unknown[]) => ({ error: uploadFails ? new Error('full') : null }))
const remove = vi.fn(async (..._a: unknown[]) => ({ error: null }))
const insert = vi.fn(async (..._a: unknown[]) => ({ error: null }))
const sb = {
  auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
  storage: { from: () => ({ upload, remove }) },
  from: (table: string) => table === 'tutor_chats'
    ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: chat, error: null }) }) }) }
    : table === 'tutor_messages'
      ? { select: () => ({ eq: () => ({ order: async () => ({ data: messages, error: null }) }) }) }
      : { insert },
}
const parse = vi.fn()
const speak = vi.fn(async (..._a: unknown[]) => ({ arrayBuffer: async () => new TextEncoder().encode('mp3-bytes').buffer }))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: async () => sb }))
vi.mock('@/lib/ai/openai', async orig => ({ ...(await orig<typeof import('@/lib/ai/openai')>()), openai: () => ({ responses: { parse }, audio: { speech: { create: speak } } }) }))
import { POST } from '@/app/api/ai/lesson/route'

const el = (id: string) => ({ id, kind: 'box', x: 10, y: 10, w: 30, h: 16, x2: 0, y2: 0, text: id, color: 'accent' })
const aiLesson = { title: 'The Krebs cycle', elements: [el('a'), el('b')], steps: [{ narration: 'First, acetyl-CoA joins in.', show: ['a'], focus: ['a'] }, { narration: 'Then it turns.', show: ['b'], focus: [] }] }
const call = (body: object = { chatId: CHAT, messageId: REPLY }) => POST(new Request('http://x', { method: 'POST', body: JSON.stringify(body) }))
const fns = () => adminRpc.mock.calls.map(c => `${c[0]}${(c[1] as { p_cost?: number })?.p_cost !== undefined ? `:${(c[1] as { p_cost: number }).p_cost}` : ''}`)

beforeEach(() => {
  chat = { id: CHAT, title: 'Respiration' }
  messages = [
    { id: USER_MSG, role: 'user', content: 'How does the Krebs cycle work?', created_at: '2026-10-30T10:00:00Z' },
    { id: REPLY, role: 'assistant', content: 'It is a loop in the mitochondrial matrix that makes NADH. '.repeat(3), created_at: '2026-10-30T10:00:05Z' },
  ]
  check = 'ok'; uploadFails = false
  adminRpc.mockClear(); parse.mockReset(); speak.mockClear(); upload.mockClear(); remove.mockClear(); insert.mockClear()
  parse.mockResolvedValue({ status: 'completed', output: [], output_parsed: aiLesson })
  process.env.OPENAI_API_KEY = 'k'
})
afterEach(() => { delete process.env.OPENAI_API_KEY })

describe('POST /api/ai/lesson', () => {
  it('writes the lesson from the question and the reply, speaks every step, keeps both with the chat, and costs two AI actions', async () => {
    const res = await call()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.script.steps.map((s: { audio: string }) => s.audio)).toEqual([`u1/${CHAT}/${body.id}-0.mp3`, `u1/${CHAT}/${body.id}-1.mp3`])
    expect(speak).toHaveBeenCalledTimes(2)
    expect(speak.mock.calls[0][0]).toMatchObject({ model: 'gpt-4o-mini-tts', input: 'First, acetyl-CoA joins in.', response_format: 'mp3' })
    expect(upload.mock.calls.map(c => c[0])).toEqual(body.script.steps.map((s: { audio: string }) => s.audio))
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ id: body.id, chat_id: CHAT, message_id: REPLY, title: 'The Krebs cycle' }))
    expect(fns()).toEqual(['ai_check:2'])
    const asked = (parse.mock.calls[0][0] as { input: { content: string }[] }).input[0].content
    expect(asked).toContain('How does the Krebs cycle work?')
    expect(asked).toContain('mitochondrial matrix')
  })
  it('refuses a message that is not one of the tutor\'s replies in the student\'s own chat, without calling the AI', async () => {
    expect((await call({ chatId: CHAT, messageId: USER_MSG })).status).toBe(404)
    expect((await call({ chatId: CHAT, messageId: '44444444-4444-4444-8444-444444444444' })).status).toBe(404)
    chat = null
    expect((await call()).status).toBe(404)
    expect((await call({ chatId: 'nope', messageId: REPLY })).status).toBe(400)
    expect(parse).not.toHaveBeenCalled()
    expect(fns()).toEqual([])
  })
  it('says so when nothing usable comes back, and gives the actions back', async () => {
    parse.mockResolvedValue({ status: 'completed', output: [], output_parsed: { title: 'x', elements: [], steps: [] } })
    const res = await call()
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: 'empty' })
    expect(fns()).toEqual(['ai_check:2', 'ai_release:2'])
    expect(speak).not.toHaveBeenCalled()
  })
  it('takes back the voices already stored, and the actions, when keeping the lesson fails', async () => {
    insert.mockResolvedValueOnce({ error: new Error('offline') } as never)
    const res = await call()
    expect(res.status).toBe(502)
    expect(remove).toHaveBeenCalledTimes(1)
    expect(remove.mock.calls[0][0]).toHaveLength(2)
    expect(fns()).toEqual(['ai_check:2', 'ai_release:2'])
  })
  it('stops at the plan\'s limit before doing anything', async () => {
    check = 'daily_limit'
    expect((await call()).status).toBe(402)
    expect(parse).not.toHaveBeenCalled()
    expect(speak).not.toHaveBeenCalled()
  })
})
