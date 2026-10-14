import { drawMarks } from './draw'
import { MAX_WIDTH, MIN_WIDTH, isBrush, type Mark, type Pt } from './marks'

// Ink on a note is kept in a fixed 1000-unit-wide space: x runs 0-1000 across the note and y is in the same units
// down the page, so a drawing keeps its place and thickness whatever width the note is shown at.
export const INK_WIDTH = 1000

export const MAX_INK_MARKS = 4000
const MAX_POINTS = 4000

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const pt = (v: unknown): v is Pt => Array.isArray(v) && v.length === 2 && num(v[0]) && num(v[1])

/** Strokes read back from the database, with anything malformed left out, so one bad entry cannot stop a note from opening */
export function sanitizeInk(raw: unknown): Mark[] {
  if (!Array.isArray(raw)) return []
  const out: Mark[] = []
  for (const m of raw.slice(0, MAX_INK_MARKS)) {
    if (!m || typeof m !== 'object') continue
    const r = m as Record<string, unknown>
    if (typeof r.id !== 'string' || !isBrush(r.brush) || typeof r.color !== 'string' || !/^#[0-9a-f]{3,8}$/i.test(r.color)) continue
    if (!num(r.width) || r.width < MIN_WIDTH || r.width > MAX_WIDTH) continue
    if (!Array.isArray(r.points) || r.points.length === 0 || r.points.length > MAX_POINTS || !r.points.every(pt)) continue
    out.push({ id: r.id, brush: r.brush, color: r.color, width: r.width, points: r.points as Pt[] })
  }
  return out
}

/** Draws the ink onto a canvas context that is `cssWidth` CSS pixels wide, with `pixelRatio` device pixels to each */
export function drawInk(ctx: CanvasRenderingContext2D, marks: Mark[], cssWidth: number, pixelRatio = 1) {
  const k = (cssWidth / INK_WIDTH) * pixelRatio
  ctx.save()
  ctx.scale(k, k)
  drawMarks(ctx, marks)
  ctx.restore()
}

/** The size of one screen pixel in drawing units, for hit tests and thresholds */
export const inkPerPixel = (cssWidth: number) => INK_WIDTH / (cssWidth || INK_WIDTH)
