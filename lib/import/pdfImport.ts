'use client'
import { supabase } from '@/lib/supabase/client'
import type { ImportedNote } from './docxToNote'

// Base64 grows a PDF by a third and the AI request is capped at 32 MB, hence 24 MB
export const MAX_PDF_BYTES = 24 * 1024 * 1024
export const MAX_PDF_PAGES = 100

export type PdfImportResult = ImportedNote & {
  via: 'ai' | 'text'
  /** Why plain-text extraction was used instead of AI, for a short notice */
  notice?: string
  truncated?: boolean
}

const MESSAGES: Record<string, string> = {
  ai_unavailable: 'AI import isn\'t available right now, so only the plain text was kept.',
  ai_failed: 'The AI service didn\'t respond, so only the plain text was kept.',
  busy: 'The AI service is busy right now, so only the plain text was kept.',
  refused: 'This PDF couldn\'t be converted by AI, so only the plain text was kept.',
  empty: 'The AI couldn\'t find text in this PDF, so only the plain text was kept.',
  rate_limited: 'You\'re going a bit fast, so only the plain text was kept. Try AI import again in a minute.',
  daily_limit: 'You\'ve used today\'s free AI actions (PDFs use 1 per 10 pages), so only the plain text was kept. Premium has no daily limit.',
  fair_use: 'You\'ve reached this month\'s fair use, so only the plain text was kept.',
  too_long: 'This PDF is too long for AI import, so only the plain text was kept.',
  too_large: 'This PDF is too large for AI import, so only the plain text was kept.',
}

async function loadPdf(file: File) {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
  return pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
}

const isAbort = (e: unknown) => (e as { name?: string })?.name === 'AbortError'

// Upload to the student's private folder, convert on the server with OpenAI, then clean up.
// AI problems fall back to extracting the PDF's text in the browser; cancelling stops everything.
export async function importPdf(file: File, userId: string, signal?: AbortSignal): Promise<PdfImportResult> {
  if (file.size > MAX_PDF_BYTES) throw new Error('This PDF is larger than 24 MB.')
  const doc = await loadPdf(file)
  if (doc.numPages > MAX_PDF_PAGES) throw new Error(`This PDF has more than ${MAX_PDF_PAGES} pages.`)

  const base = (file.name.replace(/[^\w .()-]/g, '_').slice(0, 100) || 'document').replace(/\.pdf$/i, '')
  const path = `${userId}/${crypto.randomUUID()}-${base}.pdf`

  const sb = supabase()
  const up = await sb.storage.from('imports').upload(path, file, { contentType: 'application/pdf' })
  let reason = 'ai_failed'
  if (!up.error) {
    try {
      const res = await fetch('/api/import/pdf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }), signal,
      })
      if (res.ok) {
        const note = await res.json() as ImportedNote & { truncated: boolean }
        return { ...note, via: 'ai', notice: note.truncated ? 'This PDF is very long; the end may be missing.' : undefined }
      }
      reason = ((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'ai_failed'
    } catch (e) {
      if (isAbort(e) || signal?.aborted) throw e
      reason = 'ai_failed'
    } finally {
      await sb.storage.from('imports').remove([path]).catch(() => {}) // the server also deletes it
    }
  }
  if (signal?.aborted) throw Object.assign(new Error('Import cancelled'), { name: 'AbortError' })
  const text = await pdfToText(doc)
  return { title: file.name.replace(/\.pdf$/i, ''), content_md: text, via: 'text', notice: MESSAGES[reason] ?? MESSAGES.ai_failed }
}

// Plain-text fallback: one paragraph per text block, pages separated by a rule
async function pdfToText(doc: Awaited<ReturnType<typeof loadPdf>>): Promise<string> {
  const pages: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent()
    let line = ''
    const lines: string[] = []
    for (const item of content.items) {
      if (!('str' in item)) continue
      line += item.str
      if (item.hasEOL) { lines.push(line.trim()); line = '' }
    }
    if (line.trim()) lines.push(line.trim())
    pages.push(lines.join('\n').replace(/\n{2,}/g, '\n\n'))
  }
  return pages.filter(Boolean).join('\n\n---\n\n')
}
