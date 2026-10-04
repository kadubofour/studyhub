import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---- fakes for Supabase, the AI conversion and the OpenAI client ----
const removed: string[][] = []
let user: { id: string } | null = { id: 'u1' }
let check = 'ok'
const adminRpc = vi.fn(async (...a: unknown[]) => ({ data: a[0] === 'ai_check' ? check : null, error: null }))
vi.mock('@/lib/supabase/admin', () => ({ adminClient: () => ({ rpc: adminRpc }) }))
const adminCalls = () => adminRpc.mock.calls.map(c => [c[0], (c[1] as { p_cost: number }).p_cost])
let pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Page >> endobj\n%%EOF')
let listed: { name: string; created_at: string }[] = []

const sb = {
  auth: { getUser: async () => ({ data: { user } }) },
  rpc: vi.fn(),
  storage: {
    from: () => ({
      download: async () => ({ data: new Blob([pdfBytes]), error: null }),
      remove: async (paths: string[]) => { removed.push(paths); return { error: null } },
      list: async () => ({ data: listed, error: null }),
    }),
  },
}
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: async () => sb }))

const pdfToNote = vi.fn(async (...args: unknown[]) => ({ args, title: 'T', content_md: 'body', truncated: false }))
vi.mock('@/lib/ai/pdfToNote', () => ({
  pdfToNote: (...args: unknown[]) => pdfToNote(...args),
  MAX_PDF_PAGES: 100,
}))
vi.mock('@/lib/ai/openai', async orig => ({ ...(await orig<typeof import('@/lib/ai/openai')>()), openai: () => ({}) }))

import { POST } from '@/app/api/import/pdf/route'

const call = (body: unknown, signal?: AbortSignal) =>
  POST(new Request('http://x/api/import/pdf', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' }, signal }))

beforeEach(() => {
  removed.length = 0; user = { id: 'u1' }; check = 'ok'; listed = []
  pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Page >> endobj\n%%EOF')
  pdfToNote.mockClear(); adminRpc.mockClear()
  process.env.OPENAI_API_KEY = 'test-key'
})
afterEach(() => { delete process.env.OPENAI_API_KEY })

describe('POST /api/import/pdf', () => {
  it('requires a signed-in student', async () => {
    user = null
    expect((await call({ path: 'u1/a.pdf' })).status).toBe(401)
  })

  it('rejects paths outside the student\'s own folder, nested paths and traversal', async () => {
    for (const path of ['u2/a.pdf', 'u1/x/a.pdf', 'u1/../u2/a.pdf', 'u1/a.txt', 42]) {
      expect((await call({ path })).status, String(path)).toBe(400)
    }
    expect(pdfToNote).not.toHaveBeenCalled()
  })

  it('checks the speed limit once, then converts (no daily cap)', async () => {
    const res = await call({ path: 'u1/a.pdf' })
    expect(res.status).toBe(200)
    expect(adminCalls()).toEqual([['ai_check', 1], ['ai_charge', 1]])
  })

  it('charges 1 AI action per 10 pages', async () => {
    pdfBytes = Buffer.from('%PDF-1.4\n' + '1 0 obj << /Type /Page >> endobj\n'.repeat(25) + '%%EOF')
    await call({ path: 'u1/a.pdf' })
    expect(adminCalls()).toEqual([['ai_check', 3], ['ai_charge', 3]])
  })
  it('reports a failed conversion as ai_failed', async () => {
    pdfToNote.mockRejectedValueOnce(new Error('boom'))
    expect((await call({ path: 'u1/a.pdf' })).status).toBe(502)
  })

  it('returns rate_limited when the student is going too fast, without converting, and still deletes the upload', async () => {
    check = 'rate_limited'
    const res = await call({ path: 'u1/a.pdf' })
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'rate_limited' })
    expect(pdfToNote).not.toHaveBeenCalled()
    expect(removed.flat()).toContain('u1/a.pdf')
  })

  it('refuses PDFs with too many pages before calling the AI', async () => {
    pdfBytes = Buffer.from('%PDF-1.4\n' + '<< /Type /Page >>\n'.repeat(101) + '%%EOF')
    const res = await call({ path: 'u1/a.pdf' })
    expect(res.status).toBe(413)
    expect(await res.json()).toEqual({ error: 'too_long' })
    expect(pdfToNote).not.toHaveBeenCalled()
    expect(adminRpc).not.toHaveBeenCalled() // the plan check isn't touched either
  })

  it('converts the PDF, passes the request\'s abort signal on, and deletes the upload', async () => {
    const controller = new AbortController()
    const res = await call({ path: 'u1/0b6e-notes.pdf' }, controller.signal)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ title: 'T', content_md: 'body', truncated: false })
    const opts = pdfToNote.mock.calls[0][3] as { signal?: AbortSignal }
    expect(opts.signal).toBeInstanceOf(AbortSignal)
    expect(removed.flat()).toContain('u1/0b6e-notes.pdf')
  })

  it('cleans up the student\'s abandoned uploads older than an hour', async () => {
    listed = [
      { name: 'old.pdf', created_at: new Date(Date.now() - 2 * 3600_000).toISOString() },
      { name: 'fresh.pdf', created_at: new Date().toISOString() },
    ]
    await call({ path: 'u1/a.pdf' })
    expect(removed.flat()).toContain('u1/old.pdf')
    expect(removed.flat()).not.toContain('u1/fresh.pdf')
  })

  it('says AI is unavailable when no API key is configured, without touching the speed limit', async () => {
    delete process.env.OPENAI_API_KEY
    const res = await call({ path: 'u1/a.pdf' })
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'ai_unavailable' })
    expect(adminRpc).not.toHaveBeenCalled()
  })
})
