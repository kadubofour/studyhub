// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readTutorStream, sendTutorMessage } from '@/lib/tutor/stream'

const bodyOf = (chunks: string[]) => new Response(new ReadableStream({
  start(c) { for (const ch of chunks) c.enqueue(new TextEncoder().encode(ch)); c.close() },
}))
const all = async (g: AsyncGenerator<unknown>) => { const o: unknown[] = []; for await (const l of g) o.push(l); return o }
afterEach(() => vi.unstubAllGlobals())

describe('readTutorStream', () => {
  it('reads one object per line, even when a line is split across chunks', async () => {
    const res = bodyOf(['{"t":"delta","text":"Hel', 'lo"}\n{"t":"done","proposals":[]}\n'])
    expect(await all(readTutorStream(res))).toEqual([{ t: 'delta', text: 'Hello' }, { t: 'done', proposals: [] }])
  })
  it('reads a last line with no newline, and skips a line that isn\'t JSON', async () => {
    const res = bodyOf(['nonsense\n{"t":"delta","text":"x"}'])
    expect(await all(readTutorStream(res))).toEqual([{ t: 'delta', text: 'x' }])
  })
})

describe('sendTutorMessage', () => {
  it('posts the message and hands back the lines', async () => {
    const fetchMock = vi.fn(async () => bodyOf(['{"t":"done","proposals":[]}\n']))
    vi.stubGlobal('fetch', fetchMock)
    const r = await sendTutorMessage('c1', 'Why?')
    expect(fetchMock).toHaveBeenCalledWith('/api/ai/tutor', expect.objectContaining({ method: 'POST', body: JSON.stringify({ chatId: 'c1', message: 'Why?' }) }))
    expect(r.ok && await all(r.lines)).toEqual([{ t: 'done', proposals: [] }])
  })
  it('turns a refusal into words, with the code', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'tutor_limit' }, { status: 402 })))
    expect(await sendTutorMessage('c1', 'Why?')).toEqual({ ok: false, error: 'tutor_limit', message: expect.stringMatching(/tutor messages/) })
  })
  it('a network failure is a plain failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline') }))
    expect(await sendTutorMessage('c1', 'Why?')).toMatchObject({ ok: false, error: 'ai_failed' })
  })
})
