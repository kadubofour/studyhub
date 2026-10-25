// The progress card as a picture. An SVG drawn onto a canvas is an image on its own: it sees neither the page's CSS variables
// nor its web fonts. So every var(--x) is written in as the colour it is on the page now (resolved through the card's
// ancestors, so the student's look and accent come through), and the text falls back to the device's own system font.

export const CARD_W = 1080
export const CARD_H = 1350

// The picture cannot load the app's web fonts, so it uses the device's own: a serif for a look whose titles are serif
export const SYSTEM_FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
export const SERIF_FONT = "'Times New Roman', Times, serif" // lining figures (Georgia's old-style 0 reads as an o)
const SERIF = /newsreader|lora/i

const VAR = /var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\)[^()]*)*))?\)/

/** `value` with each var(--x) replaced by its value on `el`, following variables that point at other variables */
export function resolveVars(value: string, el: Element, depth = 0): string {
  const style = getComputedStyle(el)
  let out = value
  for (let i = 0; i < 50; i++) {
    const m = VAR.exec(out)
    if (!m) break
    let v = style.getPropertyValue(m[1]).trim()
    if (!v) v = (m[2] ?? '').trim()
    if (v.includes('var(') && depth < 10) v = resolveVars(v, el, depth + 1)
    out = out.slice(0, m.index) + v + out.slice(m.index + m[0].length)
  }
  return out
}

/** The card's markup, standalone: fixed 1080×1350 size, the namespace, and the look's colours written in */
export function cardSvgMarkup(svg: SVGSVGElement): string {
  const copy = svg.cloneNode(true) as SVGSVGElement
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  copy.setAttribute('width', String(CARD_W))
  copy.setAttribute('height', String(CARD_H))
  copy.removeAttribute('class')
  copy.removeAttribute('style')
  for (const node of [copy, ...Array.from(copy.querySelectorAll('*'))]) {
    const font = node.getAttribute('font-family')
    if (font) node.setAttribute('font-family', SERIF.test(resolveVars(font, svg)) ? SERIF_FONT : SYSTEM_FONT)
    for (const attr of Array.from(node.attributes)) {
      if (attr.value.includes('var(')) node.setAttribute(attr.name, resolveVars(attr.value, svg))
    }
  }
  return new XMLSerializer().serializeToString(copy)
}

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image()
  img.decoding = 'async'
  img.onload = () => resolve(img)
  img.onerror = () => reject(new Error('card_image'))
  img.src = src
})

/** The card drawn as a 1080×1350 PNG */
export async function cardPng(svg: SVGSVGElement): Promise<Blob> {
  const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(cardSvgMarkup(svg))}`)
  const canvas = document.createElement('canvas')
  canvas.width = CARD_W; canvas.height = CARD_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('card_image')
  ctx.drawImage(img, 0, 0, CARD_W, CARD_H)
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('card_image'))), 'image/png'))
}
