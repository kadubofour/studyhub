// A PDF read by the AI comes back with marks: <!-- page N --> before each page's content, and [[figure: what it shows | x0,y0,x1,y1]] where a
// visual aid sits, the box being its place on the page in percent. This puts each figure there as a picture and takes the marks out:
// - a figure with a box is cut out of the drawn page, so it shows however the PDF made it (a photo, lines and shapes, a chart);
// - a figure with no usable box takes the page's next embedded picture, else a picture of the whole page, once;
// - on a page the AI marked nothing on, the pictures it holds are put at its end, so a PDF the AI called text only still shows them.

export type Box = { x0: number; y0: number; x1: number; y1: number }
export type PagePictures = {
  /** The page's embedded pictures, as the note's Markdown, in the order the page draws them */
  pictures: (page: number) => Promise<string[]>
  /** The box (percent of the page) cut out of the drawn page (null when it cannot be drawn) */
  crop: (page: number, box: Box, caption: string) => Promise<string | null>
  /** The whole page as a picture */
  snapshot: (page: number, caption: string) => Promise<string | null>
  /** Whether the page draws anything besides text (pictures, or many lines and shapes) */
  hasGraphics?: (page: number) => Promise<boolean>
}

const PAGE = /^\s*<!--\s*page\s+(\d+)\s*-->\s*$/i
const FIGURE = /^\s*\[\[\s*figure\s*:?\s*([^\]|]*?)\s*(?:\|\s*([^\]]*?))?\s*\]\]\s*$/i

/** "10, 20, 90, 60" as a box in percent, made to fit the page; null when it is not a box worth cutting out */
export function parseBox(text: string | undefined): Box | null {
  const n = (text ?? '').split(/[\s,]+/).filter(Boolean).map(Number)
  if (n.length !== 4 || n.some(v => !Number.isFinite(v))) return null
  const c = (v: number) => Math.min(100, Math.max(0, v))
  const [x0, y0, x1, y1] = [Math.min(n[0], n[2]), Math.min(n[1], n[3]), Math.max(n[0], n[2]), Math.max(n[1], n[3])].map(c)
  return x1 - x0 >= 4 && y1 - y0 >= 4 ? { x0, y0, x1, y1 } : null
}

export async function placeFigures(md: string, source: PagePictures): Promise<string> {
  const out: string[] = []
  let page = 0
  let queue: string[] = []
  let marks = 0
  let snapped = false
  const endPage = () => {
    if (!marks && queue.length) out.push('', ...queue.flatMap(p => [p, '']).slice(0, -1), '')
    queue = []; marks = 0; snapped = false
  }

  for (const line of md.split('\n')) {
    const p = PAGE.exec(line)
    if (p) {
      endPage()
      out.push('') // a page starts a new paragraph
      page = Number(p[1])
      queue = await source.pictures(page).catch(() => [])
      continue
    }
    const f = FIGURE.exec(line)
    if (!f) { out.push(line); continue }
    marks++
    const caption = f[1].trim(), box = parseBox(f[2])
    // a picture is a paragraph of its own, or it would join the text around it
    const put = (md: string | null | undefined) => { if (md) out.push('', md, '') }
    if (box && page) {
      const shot = await source.crop(page, box, caption).catch(() => null)
      if (shot) { put(shot); continue }
    }
    const next = queue.shift()
    if (next) put(next)
    else if (page && !snapped) {
      snapped = true
      const shot = await source.snapshot(page, caption).catch(() => null)
      if (shot) put(shot)
      else if (caption) put(`*${caption}*`)
    } else if (caption && !snapped) put(`*${caption}*`)
  }
  endPage()
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** For a PDF read without the AI: each page's text, then its pictures; a page that draws shapes or lines (no picture files) shows as a picture of the page */
export async function textWithPictures(pages: string[], source: PagePictures): Promise<string> {
  const out: string[] = []
  for (let i = 0; i < pages.length; i++) {
    let pics = await source.pictures(i + 1).catch(() => [])
    if (!pics.length && await source.hasGraphics?.(i + 1).catch(() => false)) pics = [await source.snapshot(i + 1, `Page ${i + 1}`).catch(() => null)].filter((s): s is string => !!s)
    const page = [pages[i], ...pics].filter(Boolean).join('\n\n')
    if (page) out.push(page)
  }
  return out.join('\n\n---\n\n')
}
