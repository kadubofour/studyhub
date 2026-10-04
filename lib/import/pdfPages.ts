import 'server-only'
import { MAX_PDF_PAGES } from '@/lib/ai/pdfToNote'

// Page count for size limits and AI charges. pdf.js reads the document properly (including pages
// kept in compressed object streams); if it can't, count page objects in the raw bytes; if that
// finds none either, assume the longest PDF allowed so an unreadable file is never undercharged.
export async function countPdfPages(bytes: Uint8Array): Promise<number> {
  try {
    const [{ getDocument }, worker] = await Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.mjs'),
    ])
    // Hand pdf.js its worker directly: in a bundled server build it can't find the worker file itself
    const g = globalThis as { pdfjsWorker?: unknown }
    g.pdfjsWorker ??= worker
    const task = getDocument({ data: new Uint8Array(bytes), disableFontFace: true, verbosity: 0 })
    try {
      return (await task.promise).numPages
    } finally {
      await task.destroy()
    }
  } catch {
    const found = (Buffer.from(bytes).toString('latin1').match(/\/Type\s*\/Page(?![a-zA-Z])/g) ?? []).length
    return found || MAX_PDF_PAGES
  }
}
