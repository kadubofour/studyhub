'use client'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import type { KeepPicture } from './pictures'
import type { PagePictures } from './placeFigures'

// The pictures a PDF page draws, taken out of the PDF itself (photos, scanned diagrams, slide images), and a picture of a whole page
// for a figure the PDF draws with lines and shapes. Each is kept through the import's keeper (stored, and given back as Markdown).

type PdfImage = { width: number; height: number; bitmap?: ImageBitmap; data?: Uint8ClampedArray | Uint8Array; kind?: number }
const RGBA = 3, RGB = 2, GRAY_1BPP = 1 // pdf.js ImageKind
const WAIT_MS = 4000

// A painted image's object, once pdf.js has decoded it (page objects, or document-wide ones whose names start "g_")
function imageObject(page: PDFPageProxy, name: string): Promise<PdfImage | null> {
  const store = name.startsWith('g_') ? page.commonObjs : page.objs
  return new Promise(resolve => {
    const t = setTimeout(() => resolve(null), WAIT_MS)
    try { store.get(name, (img: PdfImage) => { clearTimeout(t); resolve(img ?? null) }) } catch { clearTimeout(t); resolve(null) }
  })
}

// An image's pixels drawn on a canvas, saved as PNG
async function toBlob(img: PdfImage): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = img.width; canvas.height = img.height
  const ctx = canvas.getContext('2d')
  if (!ctx || !img.width || !img.height) return null
  if (img.bitmap) ctx.drawImage(img.bitmap, 0, 0)
  else if (img.data) {
    const out = ctx.createImageData(img.width, img.height)
    const px = img.width * img.height
    if (img.kind === RGBA) out.data.set(img.data.subarray(0, px * 4))
    else if (img.kind === RGB) for (let i = 0, j = 0; i < px; i++, j += 3) { out.data[i * 4] = img.data[j]; out.data[i * 4 + 1] = img.data[j + 1]; out.data[i * 4 + 2] = img.data[j + 2]; out.data[i * 4 + 3] = 255 }
    else if (img.kind === GRAY_1BPP) {
      const rowBytes = (img.width + 7) >> 3
      for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
        const on = (img.data[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1
        const i = (y * img.width + x) * 4
        out.data[i] = out.data[i + 1] = out.data[i + 2] = on ? 255 : 0; out.data[i + 3] = 255
      }
    } else return null
    ctx.putImageData(out, 0, 0)
  } else return null
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
}

/** Reads a loaded PDF's pictures, page by page, for placeFigures. Each page is read once, whatever asks for it. */
export function pdfPagePictures(doc: PDFDocumentProxy, keep: KeepPicture, OPS: { paintImageXObject: number; paintInlineImageXObject: number; paintImageXObjectRepeat: number }): PagePictures {
  const read = new Map<number, Promise<string[]>>()
  const pictures = (n: number) => {
    if (n < 1 || n > doc.numPages) return Promise.resolve([])
    if (!read.has(n)) read.set(n, (async () => {
      const page = await doc.getPage(n)
      const ops = await page.getOperatorList()
      const names: string[] = []
      ops.fnArray.forEach((fn, i) => {
        if (fn === OPS.paintImageXObject || fn === OPS.paintImageXObjectRepeat) names.push(String(ops.argsArray[i][0]))
      })
      const out: string[] = []
      for (const name of [...new Set(names)]) {
        const img = await imageObject(page, name)
        const blob = img ? await toBlob(img).catch(() => null) : null
        const md = blob ? await keep(blob, '').catch(() => null) : null
        if (md) out.push(md)
      }
      return out
    })().catch(() => []))
    return read.get(n)!
  }
  // The whole page, drawn a little larger than the screen shows it, for a figure made of lines and shapes
  const snapshot = async (n: number, caption: string) => {
    const page = await doc.getPage(n)
    const viewport = page.getViewport({ scale: 1.6 })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvas, canvasContext: ctx, viewport }).promise
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.88))
    return blob ? keep(blob, caption || `Page ${n}`) : null
  }
  return { pictures, snapshot }
}
