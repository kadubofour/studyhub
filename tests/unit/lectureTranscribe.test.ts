import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const ID = '7d1f5c2a-4b6e-4c8d-9a0b-1c2d3e4f5a6b'
let user: { id: string } | null = { id: 'u1' }
let check = 'ok'
let parts: Record<string, unknown>[] = []
const updates: Record<string, unknown>[] = []
const adminRpc = vi.fn(async (...a: unknown[]) => ({ data: a[0] === 'transcription_check' ? check : null, error: null }))
vi.mock('@/lib/supabase/admin', () => ({ adminClient: () => ({ rpc: adminRpc }) }))
const sb = {
  auth: { getUser: async () => ({ data: { user } }) },
  from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: ID, mime: 'audio/webm', parts } }) }) }),
    update: (patch: Record<string, unknown>) => ({ eq: async () => { updates.push(patch); return { error: null } } }),
  }),
  storage: { from: () => ({ download: async (path: string) => ({ data: new Blob([`audio of ${path}`]), error: null }) }) },
}
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: async () => sb }))
const create = vi.fn()
vi.mock('@/lib/ai/openai', async orig => ({ ...(await orig<typeof import('@/lib/ai/openai')>()), openai: () => ({ audio: { transcriptions: { create } } }) }))
import { POST } from '@/app/api/lectures/[id]/transcribe/route'
import { mergeParts } from '@/lib/ai/transcribe'

const call = (part: number | string, id = ID) => POST(new Request(`http://x/api/lectures/${id}/transcribe?part=${part}`, { method: 'POST' }), { params: Promise.resolve({ id }) })
const part = (i: number, over: object = {}) => ({ path: `u1/${ID}-${i}.webm`, start: i * 1200, duration: 1200, bytes: 1000, transcribed: false, ...over })
const whisper = (segments: { start: number; end: number; text: string }[], duration = 1200) => create.mockResolvedValueOnce({ duration, segments })
const rpcCalls = () => adminRpc.mock.calls.map(c => [c[0], (c[1] as { p_seconds: number }).p_seconds])

beforeEach(() => {
  user = { id: 'u1' }; check = 'ok'; updates.length = 0; adminRpc.mockClear(); create.mockReset()
  parts = [part(0), part(1)]
  process.env.OPENAI_API_KEY = 'test-key'
})
afterEach(() => { delete process.env.OPENAI_API_KEY })

describe('POST /api/lectures/[id]/transcribe', () => {
  it('needs a signed-in student, a lecture id and a part number', async () => {
    expect((await call('x')).status).toBe(400)
    expect((await call(0, 'nope')).status).toBe(400)
    user = null
    expect((await call(0)).status).toBe(401)
  })

  it('transcribes one part with whisper, timing lines from the start of the lecture, and charges its seconds', async () => {
    whisper([{ start: 0, end: 3.2, text: ' Welcome back. ' }, { start: 3.2, end: 7, text: '' }], 1180)
    const res = await call(1)
    expect(await res.json()).toEqual({ status: 'processing', done: 1, total: 2 })
    const sent = create.mock.calls[0][0] as { model: string; response_format: string; timestamp_granularities: string[] }
    expect(sent).toMatchObject({ model: 'whisper-1', response_format: 'verbose_json', timestamp_granularities: ['segment'] })
    const saved = updates.at(-1) as { parts: { transcribed: boolean; segments?: unknown }[] }
    expect(saved.parts[1]).toMatchObject({ transcribed: true, segments: [{ start: 1200, end: 1203.2, text: 'Welcome back.' }] })
    expect(saved.parts[0].transcribed).toBe(false)
    expect(rpcCalls()).toEqual([['transcription_check', 1200], ['transcription_record', 1180]])
  })

  it('the last part completes the transcript, replacing the live one', async () => {
    parts = [part(0, { transcribed: true, segments: [{ start: 2, end: 4, text: 'Second.' }, { start: 0, end: 2, text: 'First.' }] }), part(1)]
    whisper([{ start: 0, end: 5, text: 'Third.' }])
    expect(await (await call(1)).json()).toEqual({ status: 'done', done: 2, total: 2 })
    const saved = updates.at(-1) as { transcript: unknown; transcript_status: string; transcript_source: string; parts: object[] }
    expect(saved.transcript).toEqual([{ start: 0, end: 2, text: 'First.' }, { start: 2, end: 4, text: 'Second.' }, { start: 1200, end: 1205, text: 'Third.' }])
    expect(saved).toMatchObject({ transcript_status: 'done', transcript_source: 'openai' })
    expect(saved.parts.every(p => !('segments' in p))).toBe(true)
  })

  it('a part already done is not sent or charged again', async () => {
    parts = [part(0, { transcribed: true, segments: [] }), part(1)]
    expect(await (await call(0)).json()).toEqual({ status: 'processing', done: 1, total: 2 })
    expect(create).not.toHaveBeenCalled()
    expect(adminRpc).not.toHaveBeenCalled()
  })

  it('Free students and fair use get 402 before any audio is sent', async () => {
    check = 'premium_required'
    const res = await call(0)
    expect(res.status).toBe(402)
    expect(await res.json()).toEqual({ error: 'premium_required' })
    check = 'fair_use'
    expect(await (await call(0)).json()).toEqual({ error: 'fair_use' })
    expect(create).not.toHaveBeenCalled()
  })

  it('a failed part marks the transcript failed, keeps finished parts and charges nothing', async () => {
    create.mockRejectedValueOnce(new Error('boom'))
    const res = await call(0)
    expect(res.status).toBe(502)
    expect(updates.at(-1)).toEqual({ transcript_status: 'failed' })
    expect(rpcCalls()).toEqual([['transcription_check', 1200]])
  })

  it('a part that doesn\'t exist is 404; without an OpenAI key, AI is unavailable', async () => {
    expect((await call(5)).status).toBe(404)
    delete process.env.OPENAI_API_KEY
    expect(await (await call(0)).json()).toEqual({ error: 'ai_unavailable' })
  })
})

describe('mergeParts', () => {
  it('puts every part\'s lines in time order', () => {
    expect(mergeParts([
      { path: 'a', start: 1200, duration: 10, bytes: 1, transcribed: true, segments: [{ start: 1200, end: 1201, text: 'B' }] },
      { path: 'b', start: 0, duration: 10, bytes: 1, transcribed: true, segments: [{ start: 0, end: 1, text: 'A' }] },
    ])).toEqual([{ start: 0, end: 1, text: 'A' }, { start: 1200, end: 1201, text: 'B' }])
  })
})
