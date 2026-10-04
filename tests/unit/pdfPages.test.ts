import { describe, it, expect } from 'vitest'
import zlib from 'node:zlib'
import { countPdfPages } from '@/lib/import/pdfPages'
import { MAX_PDF_PAGES } from '@/lib/ai/pdfToNote'

// A valid PDF whose page objects sit in a compressed object stream (as many modern PDF writers
// produce), so "/Type /Page" never appears in the raw bytes
function compressedPdf(pages: number): Buffer {
  const pageIds = Array.from({ length: pages }, (_, i) => 3 + i)
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pages} >>`,
    ...pageIds.map(() => '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >>'),
  ]
  let body = ''
  const offsets: number[] = []
  for (const o of objs) { offsets.push(body.length); body += `${o}\n` }
  const header = objs.map((_, i) => `${i + 1} ${offsets[i]}`).join(' ') + '\n'
  const packed = zlib.deflateSync(Buffer.from(header + body, 'latin1'))
  const stmId = objs.length + 1
  const xrefId = stmId + 1
  const parts: Buffer[] = [Buffer.from('%PDF-1.5\n', 'latin1')]
  const at = () => parts.reduce((n, p) => n + p.length, 0)
  const stmAt = at()
  parts.push(Buffer.from(`${stmId} 0 obj\n<< /Type /ObjStm /N ${objs.length} /First ${header.length} /Filter /FlateDecode /Length ${packed.length} >>\nstream\n`, 'latin1'), packed, Buffer.from('\nendstream\nendobj\n', 'latin1'))
  const xrefAt = at()
  const row = (type: number, a: number, b: number) => Buffer.from([type, (a >>> 24) & 255, (a >>> 16) & 255, (a >>> 8) & 255, a & 255, (b >>> 8) & 255, b & 255])
  const table = Buffer.concat([row(0, 0, 65535), ...objs.map((_, i) => row(2, stmId, i)), row(1, stmAt, 0), row(1, xrefAt, 0)])
  parts.push(Buffer.from(`${xrefId} 0 obj\n<< /Type /XRef /Size ${xrefId + 1} /W [1 4 2] /Root 1 0 R /Length ${table.length} >>\nstream\n`, 'latin1'), table, Buffer.from(`\nendstream\nendobj\nstartxref\n${xrefAt}\n%%EOF\n`, 'latin1'))
  return Buffer.concat(parts)
}

describe('countPdfPages', () => {
  it('counts pages stored in compressed object streams', async () => {
    const pdf = compressedPdf(23)
    expect(pdf.toString('latin1')).not.toMatch(/\/Type\s*\/Page(?![a-zA-Z])/) // the old count saw 0 pages
    expect(await countPdfPages(pdf)).toBe(23)
  })
  it('falls back to counting page objects when pdf.js can\'t read the file', async () => {
    expect(await countPdfPages(Buffer.from('not a pdf /Type /Page /Type /Page', 'latin1'))).toBe(2)
  })
  it('treats a file with no countable pages as the longest allowed, so it is never undercharged', async () => {
    expect(await countPdfPages(Buffer.from('not a pdf', 'latin1'))).toBe(MAX_PDF_PAGES)
  })
})
