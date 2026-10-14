import { newId, type Mark, type Pt } from './marks'
import { toSegment } from './hit'

/** The rubber's radius for a thickness setting, in drawing units */
export const rubberRadius = (width: number) => 4 + width * 1.2

// Puts extra points along long gaps, so the rubber cannot jump over a stretch of line between two far-apart points
function densify(points: Pt[], maxGap: number): Pt[] {
  const out: Pt[] = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i]
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / maxGap)
    for (let k = 1; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n])
  }
  return out
}

/**
 * Rubs out the part of every stroke that the rubber touches, and keeps the rest: a stroke the rubber crosses is cut
 * in two, one it covers is gone. Marks the rubber does not touch are returned as they were (the same objects, and the
 * same list when nothing changed at all).
 */
export function rubOut(marks: Mark[], at: Pt, radius: number): Mark[] {
  let changed = false
  const out: Mark[] = []
  for (const m of marks) {
    // Cheap check before the careful one: how far the rubber is from the line itself, not just from its points
    const gap = m.points.length === 1 ? Math.hypot(m.points[0][0] - at[0], m.points[0][1] - at[1]) : Math.min(...m.points.slice(1).map((q, i) => toSegment(at, m.points[i], q)))
    const near = gap <= radius
    if (!near) { out.push(m); continue }
    const pts = densify(m.points, Math.max(radius / 2, 0.5))
    const runs: Pt[][] = []
    let run: Pt[] = []
    let hit = false
    for (const p of pts) {
      if (Math.hypot(p[0] - at[0], p[1] - at[1]) <= radius) { hit = true; if (run.length) runs.push(run); run = [] } else run.push(p)
    }
    if (run.length) runs.push(run)
    if (!hit) { out.push(m); continue }
    changed = true
    for (const r of runs) if (r.length > 1) out.push({ ...m, id: newId(), points: r })
  }
  return changed ? out : marks
}
