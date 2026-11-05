import 'server-only'
import JSZip from 'jszip'
import { MATERIAL_MIME } from '@/lib/data/materials'

// A kept file's text, for the tutor to read. Plain words only: how a file looks does not matter here. Nothing comes back from a file that has no text in it
// (a scanned PDF, a photo).

export const MAX_MATERIAL_TEXT = 200_000
// Fewer words than this is a scanned PDF's stray marks, not text
const MIN_WORDS = 8

async function pdfText(bytes: Uint8Array): Promise<string> {
  const [{ getDocument }, worker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.mjs'),
  ])
  const g = globalThis as { pdfjsWorker?: unknown }
  g.pdfjsWorker ??= worker
  const task = getDocument({ data: new Uint8Array(bytes), disableFontFace: true, verbosity: 0 })
  try {
    const doc = await task.promise
    const pages: string[] = []
    let length = 0
    for (let i = 1; i <= doc.numPages && length < MAX_MATERIAL_TEXT; i++) {
      const { items } = await (await doc.getPage(i)).getTextContent()
      const text = items.map(it => ('str' in it ? it.str + (it.hasEOL ? '\n' : '') : '')).join('').trim()
      if (text) { pages.push(`[Page ${i}]\n${text}`); length += text.length }
    }
    return pages.join('\n\n')
  } finally {
    await task.destroy()
  }
}

const XML_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const unescapeXml = (s: string) => s.replace(/&(amp|lt|gt|quot|apos);/g, (_m, e: string) => XML_ENTITIES[e])

async function pptxText(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes)
  const number = (p: string) => Number(/slide(\d+)\.xml$/.exec(p)?.[1] ?? 0)
  const paths = Object.keys(zip.files).filter(p => /^ppt\/slides\/slide\d+\.xml$/.test(p)).sort((a, b) => number(a) - number(b))
  const slides: string[] = []
  for (const p of paths) {
    const xml = await zip.file(p)!.async('string')
    const paragraphs = xml.split(/<\/a:p>/).map(par => [...par.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(m => unescapeXml(m[1])).join('')).filter(s => s.trim())
    if (paragraphs.length) slides.push(`[Slide ${number(p)}]\n${paragraphs.join('\n')}`)
  }
  return slides.join('\n\n')
}

async function docxText(bytes: Uint8Array): Promise<string> {
  const mammoth = await import('mammoth')
  return (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value
}

/** The file's text, tidied and within what is kept. Throws if the file cannot be read at all. */
export async function materialText(bytes: Uint8Array, mime: string): Promise<string> {
  const raw = mime === MATERIAL_MIME.pdf ? await pdfText(bytes)
    : mime === MATERIAL_MIME.pptx ? await pptxText(bytes)
      : mime === MATERIAL_MIME.docx ? await docxText(bytes)
        : mime.startsWith('text/') ? new TextDecoder().decode(bytes)
          : ''
  // the database cannot hold a NUL, and the other control characters are never words
  const text = raw.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  const words = text.replace(/\[(Page|Slide) \d+\]/g, '').match(/[\p{L}\p{N}]+/gu)?.length ?? 0
  return words >= MIN_WORDS ? text.slice(0, MAX_MATERIAL_TEXT) : ''
}
