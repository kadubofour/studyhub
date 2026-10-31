// A PDF read by the AI comes back with marks: <!-- page N --> before each page's content, and [[figure: what it shows]] where a
// figure sits. This puts the PDF's own pictures there and takes the marks out:
// - each figure mark on a page takes that page's next picture, in the order they are drawn;
// - a figure the PDF draws with lines and shapes (no picture to take) is shown as a picture of its whole page, once;
// - a picture no mark asked for still goes in, at the end of its page, so nothing the PDF showed is lost.

export type PagePictures = {
  /** The page's pictures, as the note's Markdown, in the order the page draws them */
  pictures: (page: number) => Promise<string[]>
  /** The whole page as a picture, for a figure drawn without one (null when it cannot be drawn) */
  snapshot: (page: number, caption: string) => Promise<string | null>
}

const PAGE = /^\s*<!--\s*page\s+(\d+)\s*-->\s*$/i
const FIGURE = /^\s*\[\[\s*figure\s*:?\s*([^\]]*)\]\]\s*$/i

export async function placeFigures(md: string, source: PagePictures): Promise<string> {
  const lines = md.split('\n')
  const out: string[] = []
  let page = 0
  let queue: string[] = []
  let snapped = false
  const endPage = () => { if (queue.length) out.push('', ...queue.flatMap(p => [p, '']).slice(0, -1), ''); queue = []; snapped = false }

  for (const line of lines) {
    const p = PAGE.exec(line)
    if (p) {
      endPage()
      out.push('') // a page starts a new paragraph
      page = Number(p[1])
      queue = await source.pictures(page).catch(() => [])
      continue
    }
    const f = FIGURE.exec(line)
    if (f) {
      const caption = f[1].trim()
      const next = queue.shift()
      // a picture is a paragraph of its own, or it would join the text around it
      if (next) out.push('', next, '')
      else if (page && !snapped) {
        snapped = true
        const shot = await source.snapshot(page, caption).catch(() => null)
        if (shot) out.push('', shot, '')
        else if (caption) out.push('', `*${caption}*`, '')
      } else if (caption && !snapped) out.push('', `*${caption}*`, '')
      continue
    }
    out.push(line)
  }
  endPage()
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** For a PDF read without the AI: each page's text, then its pictures */
export async function textWithPictures(pages: string[], pictures: PagePictures['pictures']): Promise<string> {
  const out: string[] = []
  for (let i = 0; i < pages.length; i++) {
    const pics = await pictures(i + 1).catch(() => [])
    const page = [pages[i], ...pics].filter(Boolean).join('\n\n')
    if (page) out.push(page)
  }
  return out.join('\n\n---\n\n')
}
