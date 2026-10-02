// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

const uploads: string[] = []
vi.mock('@/lib/supabase/client', () => ({
  supabase: () => ({
    storage: { from: () => ({
      upload: async (path: string) => { uploads.push(path); return { error: null } },
      remove: async () => ({ error: null }),
    }) },
  }),
}))
let pages = 3
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {},
  getDocument: () => ({ promise: Promise.resolve({
    numPages: pages,
    getPage: async () => ({ getTextContent: async () => ({ items: [{ str: 'Plain text', hasEOL: true }] }) }),
  }) }),
}))

import { importPdf } from '@/lib/import/pdfImport'

const pdf = (bytes = 10) => new File([new Uint8Array(bytes)], 'Week 3.pdf', { type: 'application/pdf' })
const respond = (status: number, body: unknown) => vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }))

beforeEach(() => { uploads.length = 0; pages = 3; vi.restoreAllMocks() })

describe('importPdf (browser side)', () => {
  it('uploads to a single-level path in the student\'s folder', async () => {
    respond(200, { title: 'T', content_md: 'b', truncated: false })
    await importPdf(pdf(), 'u1')
    expect(uploads[0]).toMatch(/^u1\/[0-9a-f-]{36}-Week 3\.pdf$/)
  })

  it('refuses files over 24 MB before uploading', async () => {
    await expect(importPdf(pdf(25 * 1024 * 1024), 'u1')).rejects.toThrow(/24 MB/)
    expect(uploads).toEqual([])
  })

  it('refuses PDFs over 100 pages before uploading', async () => {
    pages = 150
    await expect(importPdf(pdf(), 'u1')).rejects.toThrow(/100 pages/)
    expect(uploads).toEqual([])
  })

  it('falls back to plain text with a clear note when today\'s AI imports are used up', async () => {
    respond(429, { error: 'quota' })
    const r = await importPdf(pdf(), 'u1')
    expect(r.via).toBe('text')
    expect(r.notice).toMatch(/20 AI imports/)
    expect(r.content_md).toContain('Plain text')
  })

  it('stops without a fallback when the student cancels', async () => {
    const controller = new AbortController()
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      controller.abort()
      throw Object.assign(new Error('aborted'), { name: 'AbortError' })
    })
    await expect(importPdf(pdf(), 'u1', controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })
})
