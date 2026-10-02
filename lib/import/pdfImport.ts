'use client'
import { supabase } from '@/lib/supabase/client'
import type { ImportedNote } from './docxToNote'

export const MAX_PDF_BYTES = 32 * 1024 * 1024

export type PdfImportResult = ImportedNote & {
  via: 'ai' | 'text'
  /** Why plain-text extraction was used instead of AI, for a short notice */
  notice?: string
  truncated?: boolean
}

const MESSAGES: Record<string, string> = {
  ai_unavailable: 'AI import isn\'t set up yet, so only the plain text was kept.',
  ai_failed: 'The AI service didn\'t respond, so only the plain text was kept.',
  busy: 'The AI service is busy right now, so only the plain text was kept.',
  refused: 'This PDF couldn\'t be converted by AI, so only the plain text was kept.',
}

// Upload to the student's private folder, convert on the server with Claude, then clean up.
// Any AI problem falls back to extracting the PDF's text in the browser.
export async function importPdf(file: File, userId: string): Promise<PdfImportResult> {
  if (file.size > MAX_PDF_BYTES) throw new Error('This PDF is larger than 32 MB.')
  const safeName = file.name.replace(/[^\w .()-]/g, '_').slice(0, 120) || 'document.pdf'
  const path = `${userId}/${crypto.randomUUID()}/${safeName.toLowerCase().endsWith('.pdf') ? safeName : `${safeName}.pdf`}`

  const sb = supabase()
  const up = await sb.storage.from('imports').upload(path, file, { contentType: 'application/pdf' })
  let reason = 'ai_failed'
  if (!up.error) {
    try {
      const res = await fetch('/api/import/pdf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }),
      })
      if (res.ok) {
        const note = await res.json() as ImportedNote & { truncated: boolean }
        return { ...note, via: 'ai', notice: note.truncated ? 'This PDF is very long; the end may be missing.' : undefined }
      }
      reason = ((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'ai_failed'
    } catch {
      reason = 'ai_failed'
    } finally {
      await sb.storage.from('imports').remove([path]).catch(() => {}) // the server also deletes it
    }
  }
  const text = await pdfToText(file)
  return { title: file.name.replace(/\.pdf$/i, ''), content_md: text, via: 'text', notice: MESSAGES[reason] ?? MESSAGES.ai_failed }
}

// Plain-text fallback: one paragraph per text block, pages separated by a rule
export async function pdfToText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
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
