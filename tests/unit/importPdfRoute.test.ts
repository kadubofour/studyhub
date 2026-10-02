import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---- fakes for Supabase, the AI conversion and the Anthropic SDK ----
const removed: string[][] = []
let user: { id: string } | null = { id: 'u1' }
let quotaLeft = true
let pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Page >> endobj\n%%EOF')
let listed: { name: string; created_at: string }[] = []

const sb = {
  auth: { getUser: async () => ({ data: { user } }) },
  rpc: vi.fn(async (fn: string) => ({ data: fn === 'consume_ai_import' ? quotaLeft : null, error: null })),
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
  PdfRefusedError: class extends Error {},
  MAX_PDF_PAGES: 100,
}))
vi.mock('@anthropic-ai/sdk', () => {
  class APIError extends Error {}
  class RateLimitError extends APIError {}
  class BadRequestError extends APIError {}
  class Anthropic { static APIError = APIError; static RateLimitError = RateLimitError; static BadRequestError = BadRequestError }
  return { default: Anthropic }
})

import { POST } from '@/app/api/import/pdf/route'

const call = (body: unknown, signal?: AbortSignal) =>
  POST(new Request('http://x/api/import/pdf', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' }, signal }))

beforeEach(() => {
  removed.length = 0; user = { id: 'u1' }; quotaLeft = true; listed = []
  pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Page >> endobj\n%%EOF')
  pdfToNote.mockClear()
  process.env.ANTHROPIC_API_KEY = 'test-key'
})
afterEach(() => { delete process.env.ANTHROPIC_API_KEY })

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

  it('refuses once today\'s AI imports are used up, and still deletes the upload', async () => {
    quotaLeft = false
    const res = await call({ path: 'u1/a.pdf' })
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'quota' })
    expect(pdfToNote).not.toHaveBeenCalled()
    expect(removed.flat()).toContain('u1/a.pdf')
  })

  it('refuses PDFs with too many pages before calling the AI', async () => {
    pdfBytes = Buffer.from('%PDF-1.4\n' + '<< /Type /Page >>\n'.repeat(101) + '%%EOF')
    const res = await call({ path: 'u1/a.pdf' })
    expect(res.status).toBe(413)
    expect(await res.json()).toEqual({ error: 'too_long' })
    expect(pdfToNote).not.toHaveBeenCalled()
    expect(sb.rpc).not.toHaveBeenCalledWith('consume_ai_import') // no allowance used
  })

  it('converts the PDF, passes the request\'s abort signal on, and deletes the upload', async () => {
    sb.rpc.mockClear()
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

  it('says AI is unavailable when no API key is configured, without using an allowance', async () => {
    delete process.env.ANTHROPIC_API_KEY
    sb.rpc.mockClear()
    const res = await call({ path: 'u1/a.pdf' })
    expect(res.status).toBe(503)
    expect(sb.rpc).not.toHaveBeenCalled()
  })
})
