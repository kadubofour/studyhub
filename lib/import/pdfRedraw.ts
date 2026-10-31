import type { Box } from './placeFigures'

// A figure in a PDF that is made of lines, shapes and labels (a number line, a Venn diagram, a graph), drawn again from those lines and labels
// instead of cut out of the page. The picture is exactly as large as what is drawn, holds nothing of the text around it, and does not depend on
// the box being cut precisely. A figure with a picture file in it, or with nothing drawn in its box, is left to the page cut.

type Matrix = number[]
type Point = [number, number]
export type PageLike = {
  getViewport: (o: { scale: number }) => { width: number; height: number; transform: number[] }
  getOperatorList: () => Promise<{ fnArray: number[]; argsArray: unknown[] }>
  getTextContent: () => Promise<{ items: unknown[]; styles?: Record<string, { fontFamily?: string }> }>
}
type TextItem = { str: string; transform: number[]; width: number; height: number; fontName?: string }
type Shape = { d: string; fill: string | null; fillOpacity: number; stroke: string | null; width: number; dash: number[]; x0: number; y0: number; x1: number; y1: number }
type Label = { text: string; x: number; y: number; size: number; family: string; x0: number; y0: number; x1: number; y1: number }

const MOVE = 0, LINE = 1, CURVE = 2, QUAD = 3, CLOSE = 4 // how pdf.js writes a path
const MAX_SHAPES = 600 // a figure with more strokes than this is a plot of data, better cut out than written out
const LABEL_REACH = 22 // a label this near (in points) the drawing belongs to it; a caption further off does not

const times = ([a0, b0, c0, d0, e0, f0]: Matrix, [a, b, c, d, e, f]: Matrix): Matrix =>
  [a0 * a + c0 * b, b0 * a + d0 * b, a0 * c + c0 * d, b0 * c + d0 * d, a0 * e + c0 * f + e0, b0 * e + d0 * f + f0]
const at = (m: Matrix, x: number, y: number): Point => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
const r = (n: number) => String(Math.round(n * 100) / 100)
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const isColor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v)

/** Redraws the lines and labels inside a box (percent of the page) as an SVG; null when there is nothing there to draw, or a picture file is */
export async function redrawFigure(page: PageLike, box: Box, OPS: Record<string, number>): Promise<{ svg: string; width: number; height: number } | null> {
  const view = page.getViewport({ scale: 1 })
  const W = view.width, H = view.height
  const area = { x0: (box.x0 / 100) * W, y0: (box.y0 / 100) * H, x1: (box.x1 / 100) * W, y1: (box.y1 / 100) * H }
  const slack = 0.03 * Math.max(W, H)
  const near = (x: number, y: number) => x >= area.x0 - slack && x <= area.x1 + slack && y >= area.y0 - slack && y <= area.y1 + slack

  const list = await page.getOperatorList()
  const shapes: Shape[] = []
  type State = { ctm: Matrix; fill: string; fillOpacity: number; stroke: string; width: number; dash: number[] }
  let s: State = { ctm: view.transform, fill: '#000000', fillOpacity: 1, stroke: '#000000', width: 1, dash: [] }
  const saved: State[] = []
  let pictureInside = false
  const paints = {
    fill: new Set([OPS.fill, OPS.eoFill, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke]),
    stroke: new Set([OPS.stroke, OPS.closeStroke, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke]),
  }

  list.fnArray.forEach((fn, i) => {
    const args = list.argsArray[i] as unknown[] | null
    if (fn === OPS.save) saved.push({ ...s })
    else if (fn === OPS.restore) s = saved.pop() ?? s
    else if (fn === OPS.transform && args) s = { ...s, ctm: times(s.ctm, args as Matrix) }
    else if (fn === OPS.setFillRGBColor && isColor(args?.[0])) s = { ...s, fill: args[0], fillOpacity: 1 }
    // a hatched or tiled fill is drawn as a light wash of its colour, rather than solid
    else if (fn === OPS.setFillColorN && args?.[0] === 'TilingPattern') s = { ...s, fill: isColor(args[1]) ? args[1] : '#6b7280', fillOpacity: 0.28 }
    else if (fn === OPS.setFillColorN && isColor(args?.[0])) s = { ...s, fill: args[0], fillOpacity: 1 }
    else if (fn === OPS.setStrokeRGBColor && isColor(args?.[0])) s = { ...s, stroke: args[0] }
    else if (fn === OPS.setLineWidth && typeof args?.[0] === 'number') s = { ...s, width: args[0] }
    else if (fn === OPS.setDash && Array.isArray(args?.[0])) s = { ...s, dash: (args[0] as number[]).filter(n => n > 0) }
    else if (fn === OPS.paintImageXObject || fn === OPS.paintImageXObjectRepeat) {
      const [x, y] = at(s.ctm, 0.5, 0.5)
      if (near(x, y)) pictureInside = true
    } else if (fn === OPS.constructPath && args) {
      const op = args[0] as number
      const doFill = paints.fill.has(op), doStroke = paints.stroke.has(op)
      if (!doFill && !doStroke) return
      const raw = (args[1] as ArrayLike<number>[] | undefined)?.[0]
      if (!raw) return
      const d: string[] = []
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
      const p = (x: number, y: number) => { const [px, py] = at(s.ctm, x, y); x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py); return `${r(px)} ${r(py)}` }
      for (let k = 0; k < raw.length;) {
        const code = raw[k]
        if (code === MOVE) { d.push(`M${p(raw[k + 1], raw[k + 2])}`); k += 3 }
        else if (code === LINE) { d.push(`L${p(raw[k + 1], raw[k + 2])}`); k += 3 }
        else if (code === CURVE) { d.push(`C${p(raw[k + 1], raw[k + 2])} ${p(raw[k + 3], raw[k + 4])} ${p(raw[k + 5], raw[k + 6])}`); k += 7 }
        else if (code === QUAD) { d.push(`Q${p(raw[k + 1], raw[k + 2])} ${p(raw[k + 3], raw[k + 4])}`); k += 5 }
        else if (code === CLOSE) { d.push('Z'); k += 1 }
        else return // a path this does not know: nothing is guessed
      }
      if (!d.length || !Number.isFinite(x0)) return
      const scale = Math.sqrt(Math.abs(s.ctm[0] * s.ctm[3] - s.ctm[1] * s.ctm[2]))
      shapes.push({ d: d.join(''), fill: doFill ? s.fill : null, fillOpacity: s.fillOpacity, stroke: doStroke ? s.stroke : null, width: Math.max(0.3, s.width * scale), dash: s.dash.map(n => n * scale), x0, y0, x1, y1 })
    }
  })
  if (pictureInside) return null

  // The strokes that sit in the box: their middle is in it, and they are not a rule running the width of the page
  const furniture = (sh: Shape) => sh.x1 - sh.x0 > 0.6 * W && sh.y1 - sh.y0 < 3 && (sh.y0 < 0.1 * H || sh.y0 > 0.9 * H) // a page's header or footer rule
  const mine = shapes.filter(sh => !furniture(sh) && near((sh.x0 + sh.x1) / 2, (sh.y0 + sh.y1) / 2) && sh.x1 - sh.x0 <= (area.x1 - area.x0) * 1.15 + slack && sh.y1 - sh.y0 <= (area.y1 - area.y0) * 1.15 + slack)
  if (!mine.length || mine.length > MAX_SHAPES) return null
  let x0 = Math.min(...mine.map(m => m.x0)), y0 = Math.min(...mine.map(m => m.y0)), x1 = Math.max(...mine.map(m => m.x1)), y1 = Math.max(...mine.map(m => m.y1))
  // a figure of a few thin strokes is a rule or an underline, not a figure
  if (mine.length < 2 && (x1 - x0 < 12 || y1 - y0 < 12)) return null

  const content = await page.getTextContent()
  const labels: Label[] = []
  for (const it of content.items as TextItem[]) {
    if (typeof it?.str !== 'string' || !it.str.trim() || !Array.isArray(it.transform)) continue
    const t = times(view.transform, it.transform)
    const size = Math.hypot(t[2], t[3]) || 10
    const wide = (it.width || it.str.length * size * 0.5) * Math.hypot(view.transform[0], view.transform[1])
    const [tx, ty] = [t[4], t[5]]
    labels.push({ text: it.str, x: tx, y: ty, size, family: content.styles?.[it.fontName ?? '']?.fontFamily || 'serif', x0: tx, y0: ty - size, x1: tx + wide, y1: ty + size * 0.3 })
  }
  // a label belongs to the figure when it is short and in the drawing, or beside or under it (not above it, where the text before it ends); a line of text, or a caption further off, does not
  const taken: Label[] = []
  const [dx0, dy0, dx1, dy1] = [x0, y0, x1, y1]
  for (const lb of labels) {
    const cx = (lb.x0 + lb.x1) / 2, cy = (lb.y0 + lb.y1) / 2
    if (lb.text.trim().length > 28 || !near(cx, cy)) continue
    if (cx >= dx0 - LABEL_REACH && cx <= dx1 + LABEL_REACH && cy >= dy0 - 4 && cy <= dy1 + LABEL_REACH) {
      taken.push(lb)
      x0 = Math.min(x0, lb.x0); y0 = Math.min(y0, lb.y0); x1 = Math.max(x1, lb.x1); y1 = Math.max(y1, lb.y1)
    }
  }

  const pad = 8
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad
  const w = x1 - x0, h = y1 - y0
  if (w < 20 || h < 20) return null
  const body = mine.map(sh => `<path d="${sh.d}" fill="${sh.fill ?? 'none'}"${sh.fill && sh.fillOpacity < 1 ? ` fill-opacity="${sh.fillOpacity}"` : ''} stroke="${sh.stroke ?? 'none'}" stroke-width="${r(sh.width)}"${sh.dash.length ? ` stroke-dasharray="${sh.dash.map(r).join(' ')}"` : ''} stroke-linejoin="round"/>`).join('')
  const text = taken.map(lb => `<text x="${r(lb.x)}" y="${r(lb.y)}" font-size="${r(lb.size)}" font-family="${esc(lb.family)}, 'Times New Roman', serif" xml:space="preserve">${esc(lb.text)}</text>`).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r(x0)} ${r(y0)} ${r(w)} ${r(h)}" width="${r(w)}" height="${r(h)}"><rect x="${r(x0)}" y="${r(y0)}" width="${r(w)}" height="${r(h)}" fill="#ffffff"/>${body}${text}</svg>`
  return { svg, width: w, height: h }
}
