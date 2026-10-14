import { describe, it, expect } from 'vitest'
import { addMark, canRedo, canUndo, clearMarks, emptyHistory, eraseMark, redo, replaceMarks, undo } from '@/lib/markup/history'
import { hitTest } from '@/lib/markup/hit'
import { rubOut, rubberRadius } from '@/lib/markup/rub'
import { drawMark } from '@/lib/markup/draw'
import { BRUSHES, BRUSH_REACH, type BrushKind, type Mark, type Pt } from '@/lib/markup/marks'

const stroke = (id: string, points: Pt[], over: Partial<Mark> = {}): Mark => ({ id, brush: 'pen', color: '#000000', width: 4, points, ...over })
const across = (id: string, y = 0, x2 = 100) => stroke(id, [[0, y], [x2, y]])

describe('history', () => {
  it('adds, erases and clears strokes', () => {
    let h = addMark(addMark(emptyHistory(), across('a')), across('b'))
    expect(h.marks.map(m => m.id)).toEqual(['a', 'b'])
    h = eraseMark(h, 'a'); expect(h.marks.map(m => m.id)).toEqual(['b'])
    h = clearMarks(h); expect(h.marks).toEqual([])
  })
  it('steps back and forth with undo and redo', () => {
    let h = addMark(addMark(emptyHistory(), across('a')), across('b'))
    h = clearMarks(h)
    h = undo(h); expect(h.marks.map(m => m.id)).toEqual(['a', 'b'])
    h = undo(h); expect(h.marks.map(m => m.id)).toEqual(['a'])
    h = redo(h); expect(h.marks.map(m => m.id)).toEqual(['a', 'b'])
    expect(canRedo(h)).toBe(true)
    h = eraseMark(h, 'a'); expect(canRedo(h)).toBe(false) // a new change drops what could have been redone
    expect(canUndo(h)).toBe(true)
  })
  it('swaps the whole drawing in one step, and does nothing for the same drawing', () => {
    const h = addMark(emptyHistory(), across('a'))
    const swapped = replaceMarks(h, [across('x')])
    expect(swapped.marks.map(m => m.id)).toEqual(['x'])
    expect(undo(swapped).marks.map(m => m.id)).toEqual(['a'])
    expect(replaceMarks(h, h.marks)).toBe(h)
  })
  it('does nothing when there is nothing to undo, redo, erase or clear', () => {
    const h = emptyHistory()
    expect(undo(h)).toBe(h); expect(redo(h)).toBe(h); expect(clearMarks(h)).toBe(h); expect(eraseMark(h, 'x')).toBe(h)
    expect(canUndo(h)).toBe(false)
  })
})

describe('the stroke eraser', () => {
  it('finds a stroke near its line and nothing far from it', () => {
    expect(hitTest([across('l')], [50, 3], 3)).toBe('l')
    expect(hitTest([across('l')], [50, 60], 3)).toBeNull()
  })
  it('allows for how broad the brush is', () => {
    const broad = stroke('h', [[0, 0], [100, 0]], { brush: 'highlighter', width: 20 }) // 60 units wide, so 30 either side
    expect(hitTest([broad], [50, 25], 0)).toBe('h')
    expect(hitTest([across('thin')], [50, 25], 0)).toBeNull()
  })
  it('takes the topmost of two strokes that overlap, and finds a single-dot stroke', () => {
    expect(hitTest([across('under'), across('over')], [50, 0], 3)).toBe('over')
    expect(hitTest([stroke('d', [[5, 5]])], [6, 5], 2)).toBe('d')
  })
})

describe('the rubber', () => {
  it('cuts a stroke in two where it crosses, and keeps both ends', () => {
    const out = rubOut([across('a', 0, 200)], [100, 0], 10)
    expect(out).toHaveLength(2)
    const xs = out.map(m => [m.points[0][0], m.points[m.points.length - 1][0]])
    expect(xs[0][0]).toBe(0); expect(xs[0][1]).toBeLessThan(100); expect(xs[0][1]).toBeGreaterThan(80)
    expect(xs[1][0]).toBeGreaterThan(100); expect(xs[1][1]).toBe(200)
    expect(out[0].id).not.toBe(out[1].id)
    expect(out.every(m => m.brush === 'pen' && m.width === 4 && m.color === '#000000')).toBe(true)
  })
  it('does not skip a stretch between two far-apart points', () => {
    const out = rubOut([stroke('a', [[0, 0], [400, 0]])], [200, 0], 10) // there is no point anywhere near x = 200
    expect(out).toHaveLength(2)
  })
  it('takes away a stroke it covers, and shortens one it touches at the end', () => {
    expect(rubOut([across('a', 0, 10)], [5, 0], 30)).toEqual([])
    const out = rubOut([across('a', 0, 200)], [195, 0], 10)
    expect(out).toHaveLength(1)
    expect(out[0].points[out[0].points.length - 1][0]).toBeLessThan(190)
  })
  it('leaves strokes it does not touch exactly as they were, and returns the same list when nothing changed', () => {
    const marks = [across('a', 0), across('b', 300)]
    expect(rubOut(marks, [50, 150], 10)).toBe(marks)
    const out = rubOut(marks, [50, 0], 10)
    expect(out[out.length - 1]).toBe(marks[1])
  })
  it('gets bigger with the size setting', () => {
    expect(rubberRadius(40)).toBeGreaterThan(rubberRadius(1))
  })
})

// A canvas stand-in that records the calls made on it and the properties set on it
function fakeCtx() {
  const calls: string[] = []
  const state: Record<string, unknown> = {}
  const ctx = new Proxy(state, {
    get: (t, k: string) => (k in t ? t[k] : (...a: unknown[]) => { calls.push(`${k}(${a.map(x => (typeof x === 'number' ? Math.round(x * 10) / 10 : Array.isArray(x) ? `[${x.join(',')}]` : String(x))).join(',')})`) }),
    set: (t, k: string, v) => { t[k] = v; return true },
  })
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, state }
}
const draw = (brush: BrushKind, over: Partial<Mark> = {}) => {
  const f = fakeCtx()
  const pts: Pt[] = [[0, 0], [10, 10], [20, 5]]
  drawMark(f.ctx, stroke('p', pts, { brush, width: 6, ...over }))
  return f
}

describe('the brushes', () => {
  it('has six brushes, each drawing a different way', () => {
    expect(BRUSHES.map(b => b.key)).toEqual(['pen', 'pencil', 'marker', 'highlighter', 'calligraphy', 'dotted'])
  })
  it('the pen is one solid line in its colour and exactly its thickness', () => {
    const { calls, state } = draw('pen', { color: '#dc2626' })
    expect(calls).toContain('moveTo(0,0)'); expect(calls).toContain('lineTo(20,5)')
    expect(state.strokeStyle).toBe('#dc2626'); expect(state.lineWidth).toBe(6)
  })
  it('thickness is any number, and the line follows it', () => {
    expect(draw('pen', { width: 1 }).state.lineWidth).toBe(1)
    expect(draw('pen', { width: 17.5 }).state.lineWidth).toBe(17.5)
    expect(draw('pen', { width: 40 }).state.lineWidth).toBe(40)
  })
  it('the highlighter is see-through and broader than the pen', () => {
    const { state } = draw('highlighter')
    expect(Number(state.globalAlpha)).toBeLessThan(0.5)
    expect(Number(state.lineWidth)).toBe(6 * BRUSH_REACH.highlighter)
  })
  it('the marker is broader than the pen and nearly solid', () => {
    const { state } = draw('marker')
    expect(Number(state.lineWidth)).toBeGreaterThan(6)
    expect(Number(state.globalAlpha)).toBeGreaterThan(0.7)
  })
  it('the pencil is a pale line with thinner, wandering passes over it, the same each time it is drawn', () => {
    const a = draw('pencil').calls, b = draw('pencil').calls
    expect(a.filter(c => c === 'stroke()').length).toBe(3)
    expect(a).toEqual(b)
    expect(draw('pencil', { id: 'other' }).calls).not.toEqual(a)
  })
  it('the calligraphy pen is thick across its nib and thin along it', () => {
    const widths: number[] = []
    const f = fakeCtx()
    const stateRef = f.state
    const origStroke = f.ctx.stroke.bind(f.ctx)
    f.ctx.stroke = () => { widths.push(Number(stateRef.lineWidth)); origStroke() }
    drawMark(f.ctx, stroke('c', [[0, 0], [50, 50], [100, 0]], { brush: 'calligraphy', width: 10 }))
    expect(widths).toHaveLength(2)
    expect(widths[0]).toBeLessThan(widths[1]) // along the nib at 45 degrees is thin; across it is thick
  })
  it('the dotted brush draws dots spaced by its thickness', () => {
    const { calls } = draw('dotted', { width: 5 })
    expect(calls).toContain('setLineDash([0,11])')
  })
  it('a single touch makes a dot in every brush', () => {
    for (const b of BRUSHES) {
      const f = fakeCtx()
      drawMark(f.ctx, stroke('d', [[5, 5]], { brush: b.key }))
      expect(f.calls.some(c => c.startsWith('arc(')), b.key).toBe(true)
    }
  })
})
