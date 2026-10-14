import { BRUSH_REACH, type Mark, type Pt } from './marks'

type Ctx = CanvasRenderingContext2D

// A small repeatable random number for a stroke, so the pencil's grain is the same each time the stroke is drawn
function seeded(id: string) {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h ^= h >>> 13; return ((h >>> 0) % 10000) / 10000 }
}

function path(ctx: Ctx, pts: Pt[]) {
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1])
  ctx.stroke()
}

function dot(ctx: Ctx, p: Pt, width: number) {
  ctx.beginPath(); ctx.arc(p[0], p[1], width / 2, 0, Math.PI * 2); ctx.fill()
}

/** Draws one stroke in its brush. Everything is in the drawing's own units; the caller scales the canvas. */
export function drawMark(ctx: Ctx, m: Mark) {
  const w = m.width * BRUSH_REACH[m.brush]
  const pts = m.points
  ctx.save()
  ctx.strokeStyle = m.color; ctx.fillStyle = m.color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  switch (m.brush) {
    case 'pen':
    case 'marker':
      if (m.brush === 'marker') ctx.globalAlpha = 0.85
      if (pts.length === 1) dot(ctx, pts[0], w); else path(ctx, pts)
      break
    case 'highlighter':
      ctx.globalAlpha = 0.35; ctx.lineCap = 'butt'
      if (pts.length === 1) dot(ctx, pts[0], w); else path(ctx, pts)
      break
    case 'pencil': {
      // A soft, slightly uneven line: a pale body and two thinner passes that wander a little either side
      const rand = seeded(m.id)
      ctx.globalAlpha = 0.5; ctx.lineWidth = w * 0.8
      if (pts.length === 1) dot(ctx, pts[0], w * 0.8); else path(ctx, pts)
      for (let pass = 0; pass < 2 && pts.length > 1; pass++) {
        ctx.globalAlpha = 0.35; ctx.lineWidth = Math.max(0.5, w * 0.45)
        path(ctx, pts.map(p => [p[0] + (rand() - 0.5) * w * 0.5, p[1] + (rand() - 0.5) * w * 0.5] as Pt))
      }
      break
    }
    case 'calligraphy': {
      // A flat nib held at 45 degrees: thick across the nib, thin along it
      if (pts.length === 1) { dot(ctx, pts[0], w * 0.6); break }
      for (let i = 1; i < pts.length; i++) {
        const angle = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0])
        ctx.lineWidth = Math.max(0.5, w * (0.18 + 0.82 * Math.abs(Math.sin(angle - Math.PI / 4))))
        ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke()
      }
      break
    }
    case 'dotted':
      ctx.setLineDash([0, w * 2.2])
      if (pts.length === 1) dot(ctx, pts[0], w); else path(ctx, pts)
      break
  }
  ctx.restore()
}

export function drawMarks(ctx: Ctx, marks: Mark[]) {
  for (const m of marks) drawMark(ctx, m)
}
