import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const ID = '7d1f5c2a-4b6e-4c8d-9a0b-1c2d3e4f5a6b'
let user: { id: string } | null = { id: 'u1' }
let check = 'ok'
let speed = 'ok'
let claimOk = true
let parts: Record<string, unknown>[] = []
const updates: Record<string, unknown>[] = []
const adminRpc = vi.fn(async (...a: unknown[]) => ({ data: a[0] === 'transcription_check' ? check : a[0] === 'ai_check' ? speed : null, error: null }))
vi.mock('@/lib/supabase/admin', () => ({ adminClient: () => ({ rpc: adminRpc }) }))
// The student's own session: the lecture row, the part claim/save functions and the audio
const sbRpc = vi.fn(async (fn: string, args: { p_part: number; p_segments?: unknown }) => {
  if (fn === 'claim_lecture_part') return { data: claimOk, error: null }
  if (fn === 'save_lecture_part') {
    parts = parts.map((p, i) => (i === args.p_part ? { ...p, transcribed: true, segments: args.p_segments } : p))
    return { data: parts, error: null }
  }
  return { data: null, error: null }
})
const sb = {
  auth: { getUser: async () => ({ data: { user } }) },
  rpc: (fn: string, args: { p_part: number; p_segments?: unknown }) => sbRpc(fn, args),
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
const adminCalls = () => adminRpc.mock.calls.map(c => [c[0], (c[1] as { p_seconds?: number; p_cost?: number }).p_seconds ?? (c[1] as { p_cost: number }).p_cost])
const sbCalls = () => sbRpc.mock.calls.map(c => c[0])

beforeEach(() => {
  user = { id: 'u1' }; check = 'ok'; speed = 'ok'; claimOk = true; updates.length = 0
  adminRpc.mockClear(); sbRpc.mockClear(); create.mockReset()
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

  it('claims the part, transcribes it with whisper timed from the lecture start, saves it and charges its seconds', async () => {
    whisper([{ start: 0, end: 3.2, text: ' Welcome back. ' }, { start: 3.2, end: 7, text: '' }], 1180)
    const res = await call(1)
    expect(await res.json()).toEqual({ status: 'processing', done: 1, total: 2 })
    const sent = create.mock.calls[0][0] as { model: string; response_format: string; timestamp_granularities: string[] }
    expect(sent).toMatchObject({ model: 'whisper-1', response_format: 'verbose_json', timestamp_granularities: ['segment'] })
    expect(sbCalls()).toEqual(['claim_lecture_part', 'save_lecture_part'])
    expect(sbRpc.mock.calls[1][1]).toEqual({ p_lecture: ID, p_part: 1, p_segments: [{ start: 1200, end: 1203.2, text: 'Welcome back.' }] })
    expect(adminCalls()).toEqual([['ai_check', 0], ['transcription_check', 1200], ['transcription_record', 1180]])
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

  it('a part already done, or being transcribed by another request, is not sent or charged again', async () => {
    parts = [part(0, { transcribed: true, segments: [] }), part(1)]
    expect(await (await call(0)).json()).toEqual({ status: 'processing', done: 1, total: 2 })
    claimOk = false
    const res = await call(1)
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'busy' })
    expect(create).not.toHaveBeenCalled()
    expect(adminCalls().filter(c => c[0] === 'transcription_record')).toEqual([])
  })

  it('Free students, fair use and the speed limit stop it before any audio is sent', async () => {
    check = 'premium_required'
    expect(await (await call(0)).json()).toEqual({ error: 'premium_required' })
    check = 'fair_use'
    expect(await (await call(0)).json()).toEqual({ error: 'fair_use' })
    check = 'ok'; speed = 'rate_limited'
    expect((await call(0)).status).toBe(429)
    expect(create).not.toHaveBeenCalled()
  })

  it('a "part" longer than a part can be is charged for what was heard, then refused', async () => {
    whisper([{ start: 0, end: 5, text: 'Hours of audio.' }], 9000)
    const res = await call(0)
    expect(res.status).toBe(413)
    expect(adminCalls().filter(c => c[0] === 'transcription_record')).toEqual([['transcription_record', 7200], ['transcription_record', 1800]])
    expect(sbCalls()).toEqual(['claim_lecture_part', 'release_lecture_part'])
  })

  it('a failed part marks the transcript failed, gives the part back and charges nothing', async () => {
    create.mockRejectedValueOnce(new Error('boom'))
    const res = await call(0)
    expect(res.status).toBe(502)
    expect(updates.at(-1)).toEqual({ transcript_status: 'failed' })
    expect(sbCalls()).toEqual(['claim_lecture_part', 'release_lecture_part'])
    expect(adminCalls().filter(c => c[0] === 'transcription_record')).toEqual([])
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
