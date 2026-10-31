// A visual lesson's script, as the AI writes it and as the player draws it: elements laid out on a 160 by 90 board, and steps that
// each reveal some of them while a line of narration is spoken. Pure and shared: the server checks what the AI wrote with
// cleanLesson, the player and the chat read the same shape.

export const BOARD_W = 160
export const BOARD_H = 90
export const MAX_STEPS = 8
export const MIN_STEPS = 2
export const MAX_ELEMENTS = 40
export const MAX_NARRATION = 420
export const MAX_TEXT = 60

export const COLORS = ['accent', 'blue', 'amber', 'green', 'muted'] as const
export const KINDS = ['box', 'circle', 'text', 'arrow'] as const
export type LessonColor = (typeof COLORS)[number]
export type LessonKind = (typeof KINDS)[number]

/** One thing on the board. box and circle fill x,y,w,h; text sits centred at x,y (h sets its size); arrow runs from x,y to x2,y2. */
export interface LessonElement { id: string; kind: LessonKind; x: number; y: number; w: number; h: number; x2: number; y2: number; text: string; color: LessonColor }
/** What the step reveals, what it points at, what is said, and where the voice is stored once made */
export interface LessonStep { narration: string; show: string[]; focus: string[]; audio?: string | null }
export interface LessonScript { title: string; elements: LessonElement[]; steps: LessonStep[] }

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const words = (s: unknown, max: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max).trim()

export class EmptyLessonError extends Error { constructor() { super('Nothing usable came back.') } }

/**
 * What the AI wrote, made safe to draw: places kept on the board, text kept short, duplicate ids and unknown ids dropped, and any
 * element no step reveals shown by the last one, so nothing written is lost. Throws EmptyLessonError when there is no lesson in it.
 */
export function cleanLesson(raw: { title?: unknown; elements?: unknown; steps?: unknown }): LessonScript {
  const seen = new Set<string>()
  const elements: LessonElement[] = []
  for (const e of Array.isArray(raw.elements) ? raw.elements : []) {
    const id = words((e as { id?: unknown })?.id, 24)
    if (!id || seen.has(id) || elements.length >= MAX_ELEMENTS) continue
    const kind = KINDS.includes((e as { kind?: LessonKind }).kind as LessonKind) ? (e as { kind: LessonKind }).kind : 'box'
    const color = COLORS.includes((e as { color?: LessonColor }).color as LessonColor) ? (e as { color: LessonColor }).color : 'accent'
    const w = clamp(num((e as { w?: unknown }).w), 0, BOARD_W), h = clamp(num((e as { h?: unknown }).h), 0, BOARD_H)
    const x = clamp(num((e as { x?: unknown }).x), 0, BOARD_W), y = clamp(num((e as { y?: unknown }).y), 0, BOARD_H)
    seen.add(id)
    elements.push({
      id, kind, color, text: words((e as { text?: unknown }).text, MAX_TEXT),
      // a box or circle that runs off the board is pulled back on; a text's size is kept readable
      w: kind === 'box' || kind === 'circle' ? clamp(w || 30, 8, BOARD_W) : w,
      h: kind === 'box' || kind === 'circle' ? clamp(h || 16, 6, BOARD_H) : clamp(h || 6, 3, 14),
      x: kind === 'box' || kind === 'circle' ? clamp(x, 0, BOARD_W - clamp(w || 30, 8, BOARD_W)) : x,
      y: kind === 'box' || kind === 'circle' ? clamp(y, 0, BOARD_H - clamp(h || 16, 6, BOARD_H)) : y,
      x2: clamp(num((e as { x2?: unknown }).x2), 0, BOARD_W), y2: clamp(num((e as { y2?: unknown }).y2), 0, BOARD_H),
    })
  }
  const steps: LessonStep[] = []
  for (const s of Array.isArray(raw.steps) ? raw.steps : []) {
    const narration = words((s as { narration?: unknown }).narration, MAX_NARRATION)
    if (!narration || steps.length >= MAX_STEPS) continue
    const known = (list: unknown) => [...new Set((Array.isArray(list) ? list : []).map(i => String(i)).filter(i => seen.has(i)))]
    steps.push({ narration, show: known((s as { show?: unknown }).show), focus: known((s as { focus?: unknown }).focus) })
  }
  if (steps.length < MIN_STEPS || elements.length === 0) throw new EmptyLessonError()
  // an element can only be revealed once: the first step that names it
  const revealed = new Set<string>()
  for (const s of steps) s.show = s.show.filter(id => !revealed.has(id) && !!revealed.add(id))
  const left = elements.filter(e => !revealed.has(e.id)).map(e => e.id)
  if (left.length) steps[steps.length - 1].show.push(...left)
  return { title: words(raw.title, 120) || 'Visual lesson', elements, steps }
}

/** For each element, the step that first shows it */
export function revealedAt(script: LessonScript): Map<string, number> {
  const at = new Map<string, number>()
  script.steps.forEach((s, i) => { for (const id of s.show) if (!at.has(id)) at.set(id, i) })
  return at
}

/** Words broken into lines of at most `max` characters (a longer word is cut), for writing inside a shape */
export function wrapText(text: string, max: number): string[] {
  const lines: string[] = []
  let line = ''
  for (let word of text.split(/\s+/).filter(Boolean)) {
    while (word.length > max) { if (line) { lines.push(line); line = '' } lines.push(word.slice(0, max)); word = word.slice(max) }
    if (!line) line = word
    else if (line.length + 1 + word.length <= max) line += ` ${word}`
    else { lines.push(line); line = word }
  }
  if (line) lines.push(line)
  return lines
}

/** The three points of an arrow's head at its end, pointing along the line from (x1,y1) to (x2,y2) */
export function arrowHead(x1: number, y1: number, x2: number, y2: number, size = 3.2): string {
  const a = Math.atan2(y2 - y1, x2 - x1)
  const p = (da: number) => `${(x2 - size * Math.cos(a + da)).toFixed(2)},${(y2 - size * Math.sin(a + da)).toFixed(2)}`
  return `${x2.toFixed(2)},${y2.toFixed(2)} ${p(0.45)} ${p(-0.45)}`
}

/** How long a step is shown when it has no voice to wait for: time to read it */
export const readingMs = (narration: string) => Math.max(2500, Math.round(narration.length * 60))
