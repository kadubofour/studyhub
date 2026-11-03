// The shapes of a visual lesson as strokes of the markup pen: the path a hand would take, a little unsteady, in SVG path form. The same element
// always gets the same stroke, so a step redrawn looks the same.

type P = [number, number]

function seeded(id: string) {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h ^= h >>> 13; return ((h >>> 0) % 10000) / 10000 - 0.5 }
}
const f = (n: number) => n.toFixed(2)

// A smooth line through the points, as the pen would run between them
function smooth(pts: P[]): string {
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`
  for (let i = 1; i < pts.length - 1; i++) d += ` Q${f(pts[i][0])} ${f(pts[i][1])} ${f((pts[i][0] + pts[i + 1][0]) / 2)} ${f((pts[i][1] + pts[i + 1][1]) / 2)}`
  const end = pts[pts.length - 1]
  return `${d} L${f(end[0])} ${f(end[1])}`
}

// The points along a straight run, each pushed a little off it
function run(a: P, b: P, rand: () => number, shake: number): P[] {
  const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 7))
  return Array.from({ length: n }, (_, i) => {
    const t = i / n
    return [a[0] + (b[0] - a[0]) * t + rand() * shake, a[1] + (b[1] - a[1]) * t + rand() * shake] as P
  })
}

/** A box drawn in one go, its end running a little past where it began, as a hand closes one */
export function boxStroke(id: string, x: number, y: number, w: number, h: number): string {
  const rand = seeded(id), shake = 0.5
  const corners: P[] = [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]
  const pts = corners.slice(0, -1).flatMap((c, i) => run(c, corners[i + 1], rand, shake))
  return smooth([...pts, [x, y], [x + Math.min(3, w / 4), y + rand() * shake]])
}

/** A circle or oval drawn in one go, overlapping a little where it closes */
export function ovalStroke(id: string, cx: number, cy: number, rx: number, ry: number): string {
  const rand = seeded(id), steps = 26, turn = (Math.PI * 2 * 1.04) / steps, from = -Math.PI * 0.6
  return smooth(Array.from({ length: steps + 1 }, (_, i) => {
    const a = from + turn * i
    return [cx + Math.cos(a) * (rx + rand() * 0.5), cy + Math.sin(a) * (ry + rand() * 0.5)] as P
  }))
}

/** A line from one point to another, a little unsteady */
export function lineStroke(id: string, x1: number, y1: number, x2: number, y2: number): string {
  const rand = seeded(id)
  return smooth([...run([x1, y1], [x2, y2], rand, 0.35), [x2, y2]])
}

/** An arrow's head as the pen draws one: two short strokes back from the tip */
export function headStroke(x1: number, y1: number, x2: number, y2: number, size = 3): string {
  const a = Math.atan2(y2 - y1, x2 - x1)
  const back = (da: number) => `${f(x2 - size * Math.cos(a + da))} ${f(y2 - size * Math.sin(a + da))}`
  return `M${back(0.5)} L${f(x2)} ${f(y2)} L${back(-0.5)}`
}
