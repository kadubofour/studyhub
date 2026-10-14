import { BRUSH_REACH, type Mark, type Pt } from './marks'

export function toSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2))
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}

/** How far a point is from the visible edge of a stroke (0 when it is on the stroke) */
export function distanceTo(m: Mark, p: Pt): number {
  const reach = (m.width * BRUSH_REACH[m.brush]) / 2
  const d = m.points.length === 1 ? Math.hypot(p[0] - m.points[0][0], p[1] - m.points[0][1]) : Math.min(...m.points.slice(1).map((q, i) => toSegment(p, m.points[i], q)))
  return Math.max(0, d - reach)
}

/** The topmost stroke within `tolerance` of the point, or null: what the stroke eraser takes out */
export function hitTest(marks: Mark[], p: Pt, tolerance: number): string | null {
  for (let i = marks.length - 1; i >= 0; i--) if (distanceTo(marks[i], p) <= tolerance) return marks[i].id
  return null
}
