import { HIGHLIGHT_FACTOR, strokeWidth, textSize, type Mark, type Pt } from './marks'

function toSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2))
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}

const toPath = (p: Pt, pts: Pt[]) => (pts.length === 1 ? Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]) : Math.min(...pts.slice(1).map((q, i) => toSegment(p, pts[i], q))))

/** How far a point is from a mark's visible line (0 for a point inside a text box) */
export function distanceTo(m: Mark, p: Pt, imageWidth: number): number {
  const reach = strokeWidth(m.size, imageWidth) * (m.kind === 'highlighter' ? HIGHLIGHT_FACTOR : 1) / 2
  switch (m.kind) {
    case 'pen': case 'highlighter': return Math.max(0, toPath(p, m.points) - reach)
    case 'line': case 'arrow': return Math.max(0, toSegment(p, m.from, m.to) - reach)
    case 'rect': {
      const [x1, x2] = [Math.min(m.from[0], m.to[0]), Math.max(m.from[0], m.to[0])]
      const [y1, y2] = [Math.min(m.from[1], m.to[1]), Math.max(m.from[1], m.to[1])]
      const corners: Pt[] = [[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]]
      return Math.max(0, toPath(p, corners) - reach)
    }
    case 'ellipse': {
      const cx = (m.from[0] + m.to[0]) / 2, cy = (m.from[1] + m.to[1]) / 2
      const rx = Math.abs(m.to[0] - m.from[0]) / 2, ry = Math.abs(m.to[1] - m.from[1]) / 2
      const ring: Pt[] = Array.from({ length: 49 }, (_, i) => [cx + rx * Math.cos(i * Math.PI / 24), cy + ry * Math.sin(i * Math.PI / 24)])
      return Math.max(0, toPath(p, ring) - reach)
    }
    case 'text': {
      const h = textSize(m.size, imageWidth), w = m.text.length * h * 0.6
      const dx = Math.max(m.at[0] - p[0], 0, p[0] - (m.at[0] + w)), dy = Math.max(m.at[1] - p[1], 0, p[1] - (m.at[1] + h))
      return Math.hypot(dx, dy)
    }
  }
}

/** The topmost mark within `tolerance` of the point, or null: what the eraser takes out */
export function hitTest(marks: Mark[], p: Pt, imageWidth: number, tolerance: number): string | null {
  for (let i = marks.length - 1; i >= 0; i--) if (distanceTo(marks[i], p, imageWidth) <= tolerance) return marks[i].id
  return null
}
