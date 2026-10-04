'use client'
import { supabase } from '@/lib/supabase/client'
import { postAi } from '@/components/ai/aiFetch'
import { MAX_PDF_BYTES, loadPdf } from '@/lib/import/pdfImport'
import { MAX_SCAN_BYTES, MAX_SCAN_PAGES } from './limits'
import type { ScanCardsResult, ScanNoteResult, ScanPlannerResult, ScanTarget } from '@/lib/ai/scan'

export type ScanPage = { id: string; file: File; kind: 'image' | 'pdf'; pages: number; preview: string | null }
export type ScanResult = { note: ScanNoteResult; cards: ScanCardsResult; planner: ScanPlannerResult }
export const SCAN_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_IMAGE_SIDE = 2000

export const SCAN_MESSAGES: Record<string, string> = {
  refused: 'Couldn\'t read these pages. Try clearer photos.',
  empty: 'Couldn\'t find anything to use on these pages. Try clearer photos, or make something else from them.',
  too_many_pages: `Up to ${MAX_SCAN_PAGES} pages per scan.`,
  too_large: 'These pages are too large together. Try fewer photos.',
  too_long: 'This scan was too long to finish. Try fewer pages.',
  upload_failed: 'Couldn\'t upload the pages. Check your connection and try again.',
}

export const pageCount = (pages: ScanPage[]) => pages.reduce((n, p) => n + p.pages, 0)
const previewOf = (f: File) => (typeof URL.createObjectURL === 'function' ? URL.createObjectURL(f) : null)

export async function countPdfPagesInBrowser(file: File): Promise<number> {
  return (await loadPdf(file)).numPages
}

// Adds chosen files as pages, checking every limit before anything is uploaded. Stops at the
// first file that can't be added and says why; the pages added before it are kept.
export async function addFiles(current: ScanPage[], files: File[], countPdf: (f: File) => Promise<number>): Promise<{ pages: ScanPage[]; error: string | null }> {
  let pages = current
  for (const file of files) {
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
    if (!isPdf && !SCAN_IMAGE_TYPES.includes(file.type)) return { pages, error: 'Use photos (JPEG, PNG or WebP) or a PDF.' }
    if (isPdf ? pages.length > 0 : pages.some(p => p.kind === 'pdf')) return { pages, error: 'Scan either photos or one PDF, not both.' }
    let n = 1
    if (isPdf) {
      if (file.size > MAX_PDF_BYTES) return { pages, error: 'This PDF is larger than 24 MB.' }
      try { n = await countPdf(file) } catch { return { pages, error: 'Couldn\'t open this PDF.' } }
      if (n > MAX_SCAN_PAGES) return { pages, error: `This PDF has ${n} pages; Scan reads up to ${MAX_SCAN_PAGES}. Use Import for longer PDFs.` }
    }
    if (pageCount(pages) + n > MAX_SCAN_PAGES) return { pages, error: `Up to ${MAX_SCAN_PAGES} pages per scan.` }
    pages = [...pages, { id: crypto.randomUUID(), file, kind: isPdf ? 'pdf' : 'image', pages: n, preview: isPdf ? null : previewOf(file) }]
  }
  return { pages, error: null }
}

export function fitWithin(width: number, height: number, max = MAX_IMAGE_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

// Phone photos are often 5–10 MB; a 2000 px JPEG keeps text readable at a fraction of the size
export async function prepareImage(file: File): Promise<Blob> {
  const unreadable = 'Couldn\'t read one of the photos. Try taking it again.'
  let bitmap: ImageBitmap
  // Use the photo's own orientation, so portrait phone photos aren't sent sideways
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }) } catch { throw new Error(unreadable) }
  const { width, height } = fitWithin(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  // JPEG has no transparency: without a white background, transparent areas turn black
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  if (!blob) throw new Error(unreadable)
  return blob
}

// Upload the pages (photos shrunk first) → read them on the server → delete the uploads.
// Cancelling (the signal) throws an AbortError, after the uploads are deleted.
export async function runScan<T extends ScanTarget>(o: {
  pages: ScanPage[]; target: T; userId: string; today: string; signal?: AbortSignal; prepare?: (f: File) => Promise<Blob>
}): Promise<{ ok: true; value: ScanResult[T] } | { ok: false; code: string; message: string }> {
  const bucket = supabase().storage.from('imports')
  const prepare = o.prepare ?? prepareImage
  const cancelled = () => new DOMException('Scan cancelled', 'AbortError')
  // Shrink every photo first, so pages too large together are refused before anything uploads
  const blobs: Blob[] = []
  for (const p of o.pages) {
    try { blobs.push(p.kind === 'pdf' ? p.file : await prepare(p.file)) } catch (e) { return { ok: false, code: 'photo', message: (e as Error).message } }
    if (o.signal?.aborted) throw cancelled()
  }
  if (blobs.reduce((n, b) => n + b.size, 0) > MAX_SCAN_BYTES) return { ok: false, code: 'too_large', message: SCAN_MESSAGES.too_large }

  const paths: string[] = []
  try {
    for (const [i, p] of o.pages.entries()) {
      if (o.signal?.aborted) throw cancelled()
      const path = `${o.userId}/${crypto.randomUUID()}-scan-${i + 1}.${p.kind === 'pdf' ? 'pdf' : 'jpg'}`
      const up = await bucket.upload(path, blobs[i], { contentType: p.kind === 'pdf' ? 'application/pdf' : 'image/jpeg' })
      if (up.error) return { ok: false, code: 'upload_failed', message: SCAN_MESSAGES.upload_failed }
      paths.push(path)
    }
    if (o.signal?.aborted) throw cancelled()
    const r = await postAi<ScanResult[T]>('/api/ai/scan', { paths, target: o.target, today: o.today }, o.signal)
    return r.ok ? r : { ok: false, code: r.error, message: SCAN_MESSAGES[r.error] ?? r.message }
  } finally {
    if (paths.length) await bucket.remove(paths).catch(() => {}) // the server deletes them too
  }
}
