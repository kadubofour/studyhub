import { drawMarks } from './draw'
import type { Mark, Pt } from './marks'

// Ink on a note is kept in a fixed 1000-unit-wide space: x runs 0-1000 across the note and y is in the same units
// down the page, so a drawing keeps its place and thickness whatever width the note is shown at.
export const INK_WIDTH = 1000
// Strokes are sized as for a picture this wide: the pen then comes out a fine 1.5 to 7 pixels on a normal screen
const INK_PEN_BASIS = 600

export const MAX_INK_MARKS = 4000
const MAX_POINTS = 4000

const KINDS = ['pen', 'highlighter', 'line', 'arrow', 'rect', 'ellipse', 'text']
const SIZES = ['S', 'M', 'L']
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const pt = (v: unknown): v is Pt => Array.isArray(v) && v.length === 2 && num(v[0]) && num(v[1])

/** Marks read back from the database, with anything malformed left out, so one bad entry cannot stop a note from opening */
export function sanitizeInk(raw: unknown): Mark[] {
  if (!Array.isArray(raw)) return []
  const out: Mark[] = []
  for (const m of raw.slice(0, MAX_INK_MARKS)) {
    if (!m || typeof m !== 'object') continue
    const r = m as Record<string, unknown>
    if (typeof r.id !== 'string' || typeof r.color !== 'string' || !/^#[0-9a-f]{3,8}$/i.test(r.color) || !SIZES.includes(r.size as string) || !KINDS.includes(r.kind as string)) continue
    const base = { id: r.id, color: r.color, size: r.size as 'S' | 'M' | 'L' }
    if (r.kind === 'pen' || r.kind === 'highlighter') {
      if (Array.isArray(r.points) && r.points.length > 0 && r.points.length <= MAX_POINTS && r.points.every(pt)) out.push({ ...base, kind: r.kind, points: r.points as Pt[] })
    } else if (r.kind === 'text') {
      if (pt(r.at) && typeof r.text === 'string' && r.text.length > 0 && r.text.length <= 200) out.push({ ...base, kind: 'text', at: r.at, text: r.text })
    } else if (pt(r.from) && pt(r.to)) {
      out.push({ ...base, kind: r.kind as 'line' | 'arrow' | 'rect' | 'ellipse', from: r.from, to: r.to })
    }
  }
  return out
}

/** Draws the ink onto a canvas context that is `cssWidth` CSS pixels wide, with `pixelRatio` device pixels to each */
export function drawInk(ctx: CanvasRenderingContext2D, marks: Mark[], cssWidth: number, pixelRatio = 1) {
  const k = (cssWidth / INK_WIDTH) * pixelRatio
  ctx.save()
  ctx.scale(k, k)
  drawMarks(ctx, marks, INK_PEN_BASIS)
  ctx.restore()
}

/** The size of one screen pixel in ink units, for hit tests and thresholds */
export const inkPerPixel = (cssWidth: number) => INK_WIDTH / (cssWidth || INK_WIDTH)
export const INK_TEXT_BASIS = INK_PEN_BASIS
