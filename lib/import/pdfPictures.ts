'use client'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import type { KeepPicture } from './pictures'
import type { Box, PagePictures } from './placeFigures'

// What a PDF page shows besides text, taken out of the PDF itself: the picture files it embeds (photos, scanned diagrams), and any area of
// the page drawn as a picture, which is how a figure made of lines and shapes (most diagrams, charts and graphs) is shown. Each is kept
// through the import's keeper (stored, and given back as Markdown).

type PdfImage = { width: number; height: number; bitmap?: ImageBitmap; data?: Uint8ClampedArray | Uint8Array; kind?: number }
const RGBA = 3, RGB = 2, GRAY_1BPP = 1 // pdf.js ImageKind
const WAIT_MS = 4000
const DRAW_WIDTH = 1600 // a page is drawn about this wide, so a figure cut from it is sharp
const SHAPE_OPS = 25 // a page with this many paths is drawing something besides text

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
export function pdfPagePictures(doc: PDFDocumentProxy, keep: KeepPicture, OPS: Record<string, number>): PagePictures {
  const ops = new Map<number, Promise<{ names: string[]; shapes: number }>>()
  const read = new Map<number, Promise<string[]>>()
  const inRange = (n: number) => n >= 1 && n <= doc.numPages

  const operators = (n: number) => {
    if (!ops.has(n)) ops.set(n, (async () => {
      const list = await (await doc.getPage(n)).getOperatorList()
      const names: string[] = []
      let shapes = 0
      list.fnArray.forEach((fn, i) => {
        if (fn === OPS.paintImageXObject || fn === OPS.paintImageXObjectRepeat) names.push(String(list.argsArray[i][0]))
        else if (fn === OPS.constructPath) shapes++
      })
      return { names, shapes }
    })().catch(() => ({ names: [], shapes: 0 })))
    return ops.get(n)!
  }

  const pictures = (n: number) => {
    if (!inRange(n)) return Promise.resolve([])
    if (!read.has(n)) read.set(n, (async () => {
      const page = await doc.getPage(n)
      const out: string[] = []
      for (const name of [...new Set((await operators(n)).names)]) {
        const img = await imageObject(page, name)
        const blob = img ? await toBlob(img).catch(() => null) : null
        const md = blob ? await keep(blob, '').catch(() => null) : null
        if (md) out.push(md)
      }
      return out
    })().catch(() => []))
    return read.get(n)!
  }

  // The page drawn on a canvas (white behind it), about DRAW_WIDTH wide
  async function drawn(n: number): Promise<HTMLCanvasElement | null> {
    const page = await doc.getPage(n)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: Math.min(3, Math.max(1, DRAW_WIDTH / base.width)) })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvas, canvasContext: ctx, viewport }).promise
    return canvas
  }
  const save = (canvas: HTMLCanvasElement, caption: string) => new Promise<string | null>(resolve =>
    canvas.toBlob(async blob => resolve(blob ? await keep(blob, caption).catch(() => null) : null), canvas.width * canvas.height > 2_500_000 ? 'image/jpeg' : 'image/png', 0.9))

  // Each page is drawn once, however many figures it has
  const pages = new Map<number, Promise<HTMLCanvasElement | null>>()
  const page = (n: number) => { if (!pages.has(n)) pages.set(n, drawn(n).catch(() => null)); return pages.get(n)! }

  return {
    pictures,
    // A figure: its box (percent of the page, with a little room round it so labels are not cut) taken from the drawn page
    crop: async (n: number, box: Box, caption: string) => {
      if (!inRange(n)) return null
      const c = await page(n)
      if (!c) return null
      const pad = 1.5
      const x0 = Math.max(0, box.x0 - pad), y0 = Math.max(0, box.y0 - pad), x1 = Math.min(100, box.x1 + pad), y1 = Math.min(100, box.y1 + pad)
      const sx = Math.round((x0 / 100) * c.width), sy = Math.round((y0 / 100) * c.height), sw = Math.max(1, Math.round(((x1 - x0) / 100) * c.width)), sh = Math.max(1, Math.round(((y1 - y0) / 100) * c.height))
      const out = document.createElement('canvas')
      out.width = sw; out.height = sh
      const ctx = out.getContext('2d')
      if (!ctx) return null
      ctx.drawImage(c, sx, sy, sw, sh, 0, 0, sw, sh)
      return save(out, caption)
    },
    snapshot: async (n: number, caption: string) => {
      if (!inRange(n)) return null
      const c = await page(n)
      return c ? save(c, caption || `Page ${n}`) : null
    },
    hasGraphics: async (n: number) => {
      if (!inRange(n)) return false
      const { names, shapes } = await operators(n)
      return names.length > 0 || shapes >= SHAPE_OPS
    },
  }
}
