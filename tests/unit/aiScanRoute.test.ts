import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

let user: { id: string } | null = { id: 'u1' }
let check = 'ok'
const adminRpc = vi.fn(async (...a: unknown[]) => ({ data: a[0] === 'ai_check' ? check : null, error: null }))
vi.mock('@/lib/supabase/admin', () => ({ adminClient: () => ({ rpc: adminRpc }) }))
const adminCalls = () => adminRpc.mock.calls.map(c => [c[0], (c[1] as { p_cost: number }).p_cost])
const removed: string[][] = []
const sb = {
  auth: { getUser: async () => ({ data: { user } }) },
  storage: { from: () => ({
    download: async (path: string) => ({ data: path.includes('huge') ? new Blob([new Uint8Array(25 * 1024 * 1024)]) : new Blob([`bytes of ${path}`]), error: null }),
    remove: async (paths: string[]) => { removed.push(paths); return { error: null } },
  }) },
}
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: async () => sb }))
let pdfPages = 3
vi.mock('@/lib/import/pdfPages', () => ({ countPdfPages: async () => pdfPages }))
const scanToNote = vi.fn(async (...a: unknown[]) => { void a; return { title: 'T', content_md: 'b', truncated: false } })
const scanToCards = vi.fn(async (...a: unknown[]) => { void a; return { cards: [{ front: 'F', back: 'B' }] } })
const scanToPlanner = vi.fn(async (...a: unknown[]) => { void a; return { tasks: [], classes: [] } })
vi.mock('@/lib/ai/scan', async orig => ({
  ...(await orig<typeof import('@/lib/ai/scan')>()),
  scanToNote: (...a: unknown[]) => scanToNote(...a),
  scanToCards: (...a: unknown[]) => scanToCards(...a),
  scanToPlanner: (...a: unknown[]) => scanToPlanner(...a),
}))
vi.mock('@/lib/ai/openai', async orig => ({ ...(await orig<typeof import('@/lib/ai/openai')>()), openai: () => ({}) }))
import { POST } from '@/app/api/ai/scan/route'

const call = (body: unknown) =>
  POST(new Request('http://x/api/ai/scan', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }))
const b64 = (path: string) => Buffer.from(`bytes of ${path}`).toString('base64')
const UUID = '0b6f3c8e-6a52-4c39-9a0e-2f4c1d7e8a90'

beforeEach(() => {
  user = { id: 'u1' }; check = 'ok'; pdfPages = 3; removed.length = 0
  adminRpc.mockClear(); scanToNote.mockClear(); scanToCards.mockClear(); scanToPlanner.mockClear()
  process.env.OPENAI_API_KEY = 'test-key'
})
afterEach(() => { delete process.env.OPENAI_API_KEY })

describe('POST /api/ai/scan', () => {
  it('requires a signed-in student', async () => {
    user = null
    expect((await call({ paths: ['u1/a.jpg'], target: 'note' })).status).toBe(401)
  })

  it('refuses paths outside the student\'s folder, odd file types and unknown targets', async () => {
    for (const body of [
      { paths: ['u2/a.jpg'], target: 'note' }, { paths: ['u1/x/a.jpg'], target: 'note' }, { paths: ['u1/../u2/a.jpg'], target: 'note' },
      { paths: ['u1/a.gif'], target: 'note' }, { paths: [], target: 'note' }, { paths: 'u1/a.jpg', target: 'note' },
      { paths: ['u1/a.jpg'], target: 'quiz' },
    ]) expect((await call(body)).status, JSON.stringify(body)).toBe(400)
    expect(scanToNote).not.toHaveBeenCalled()
  })

  it('reads photos in order into a note, charges 1 AI action and deletes the uploads', async () => {
    const paths = [`u1/${UUID}-scan-1.jpg`, `u1/${UUID}-scan-2.png`]
    const res = await call({ paths, target: 'note' })
    expect(await res.json()).toEqual({ title: 'T', content_md: 'b', truncated: false })
    expect(scanToNote.mock.calls[0][1]).toEqual([
      { kind: 'image', mime: 'image/jpeg', base64: b64(paths[0]) },
      { kind: 'image', mime: 'image/png', base64: b64(paths[1]) },
    ])
    expect(adminCalls()).toEqual([['ai_check', 1]])
    expect(removed).toEqual([paths])
  })

  it('reads one PDF under its own name, and makes cards', async () => {
    const path = `u1/${UUID}-Week 3.pdf`
    expect(await (await call({ paths: [path], target: 'cards' })).json()).toEqual({ cards: [{ front: 'F', back: 'B' }] })
    expect(scanToCards.mock.calls[0][1]).toEqual([{ kind: 'pdf', name: 'Week 3.pdf', base64: b64(path) }])
  })

  it('gives the planner the student\'s date, or the server\'s when it is missing or bad', async () => {
    await call({ paths: ['u1/a.jpg'], target: 'planner', today: '2026-10-04' })
    await call({ paths: ['u1/a.jpg'], target: 'planner', today: 'friday' })
    expect(scanToPlanner.mock.calls[0][2]).toBe('2026-10-04')
    expect(scanToPlanner.mock.calls[1][2]).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('refuses more than 10 pages, or a PDF with photos, and still deletes the uploads', async () => {
    const eleven = Array.from({ length: 11 }, (_, i) => `u1/p${i}.jpg`)
    const res = await call({ paths: eleven, target: 'note' })
    expect(res.status).toBe(413)
    expect(await res.json()).toEqual({ error: 'too_many_pages' })
    expect((await call({ paths: ['u1/a.pdf', 'u1/b.jpg'], target: 'note' })).status).toBe(413)
    pdfPages = 12
    expect((await call({ paths: ['u1/a.pdf'], target: 'note' })).status).toBe(413)
    expect(scanToNote).not.toHaveBeenCalled()
    expect(removed).toHaveLength(3)
  })

  it('refuses pages over 24 MB together', async () => {
    const res = await call({ paths: ['u1/huge.jpg'], target: 'note' })
    expect(res.status).toBe(413)
    expect(await res.json()).toEqual({ error: 'too_large' })
  })

  it('a read that fails or is cancelled gives the AI action back, and still deletes the uploads', async () => {
    scanToNote.mockRejectedValueOnce(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    const controller = new AbortController()
    controller.abort()
    await POST(new Request('http://x/api/ai/scan', { method: 'POST', body: JSON.stringify({ paths: ['u1/a.jpg'], target: 'note' }), headers: { 'content-type': 'application/json' }, signal: controller.signal }))
    expect(adminCalls()).toEqual([['ai_check', 1], ['ai_release', 1]])
    expect(removed).toEqual([['u1/a.jpg']])
  })

  it('at the plan limit: 402, no AI call, uploads deleted', async () => {
    check = 'daily_limit'
    const res = await call({ paths: ['u1/a.jpg'], target: 'note' })
    expect(res.status).toBe(402)
    expect(scanToNote).not.toHaveBeenCalled()
    expect(removed).toEqual([['u1/a.jpg']])
  })

  it('without an OpenAI key: AI unavailable, uploads deleted', async () => {
    delete process.env.OPENAI_API_KEY
    const res = await call({ paths: ['u1/a.jpg'], target: 'note' })
    expect(await res.json()).toEqual({ error: 'ai_unavailable' })
    expect(removed).toHaveLength(1)
  })
})
