import { describe, it, expect, vi } from 'vitest'
import { addMark, canRedo, canUndo, clearMarks, emptyHistory, eraseMark, redo, undo } from '@/lib/markup/history'
import { hitTest } from '@/lib/markup/hit'
import { drawMark, flatten } from '@/lib/markup/draw'
import { strokeWidth, textSize, type Mark } from '@/lib/markup/marks'

const line = (id: string, from: [number, number], to: [number, number]): Mark => ({ id, kind: 'line', color: '#000', size: 'M', from, to })
const pen = (id: string): Mark => ({ id, kind: 'pen', color: '#000', size: 'S', points: [[0, 0], [100, 0]] })

describe('history', () => {
  it('adds, erases and clears marks', () => {
    let h = addMark(addMark(emptyHistory(), pen('a')), pen('b'))
    expect(h.marks.map(m => m.id)).toEqual(['a', 'b'])
    h = eraseMark(h, 'a'); expect(h.marks.map(m => m.id)).toEqual(['b'])
    h = clearMarks(h); expect(h.marks).toEqual([])
  })
  it('steps back and forth with undo and redo, including a clear', () => {
    let h = addMark(addMark(emptyHistory(), pen('a')), pen('b'))
    h = clearMarks(h)
    h = undo(h); expect(h.marks.map(m => m.id)).toEqual(['a', 'b'])
    h = undo(h); expect(h.marks.map(m => m.id)).toEqual(['a'])
    h = redo(h); expect(h.marks.map(m => m.id)).toEqual(['a', 'b'])
    expect(canRedo(h)).toBe(true)
    h = eraseMark(h, 'a'); expect(canRedo(h)).toBe(false) // a new change drops what could have been redone
    expect(canUndo(h)).toBe(true)
  })
  it('does nothing when there is nothing to undo, redo, erase or clear', () => {
    const h = emptyHistory()
    expect(undo(h)).toBe(h); expect(redo(h)).toBe(h); expect(clearMarks(h)).toBe(h); expect(eraseMark(h, 'x')).toBe(h)
    expect(canUndo(h)).toBe(false)
  })
})

describe('hit test for the eraser', () => {
  it('finds a mark near its line and nothing far from it', () => {
    const marks = [line('l', [0, 0], [100, 0])]
    expect(hitTest(marks, [50, 3], 1000, 8)).toBe('l')
    expect(hitTest(marks, [50, 60], 1000, 8)).toBeNull()
  })
  it('takes the topmost of two marks that overlap', () => {
    expect(hitTest([line('under', [0, 0], [100, 0]), line('over', [0, 0], [100, 0])], [50, 0], 1000, 8)).toBe('over')
  })
  it('finds a rectangle by its edge and not its empty middle, and an ellipse by its ring', () => {
    const rect: Mark = { id: 'r', kind: 'rect', color: '#000', size: 'S', from: [0, 0], to: [200, 100] }
    expect(hitTest([rect], [100, 1], 1000, 6)).toBe('r')
    expect(hitTest([rect], [100, 50], 1000, 6)).toBeNull()
    const oval: Mark = { id: 'o', kind: 'ellipse', color: '#000', size: 'S', from: [0, 0], to: [200, 100] }
    expect(hitTest([oval], [100, 0], 1000, 6)).toBe('o')
    expect(hitTest([oval], [100, 50], 1000, 6)).toBeNull()
  })
  it('finds a text mark anywhere inside its box and a single-dot pen mark', () => {
    const text: Mark = { id: 't', kind: 'text', color: '#000', size: 'M', at: [10, 10], text: 'ATP' }
    expect(hitTest([text], [20, 20], 1000, 4)).toBe('t')
    expect(hitTest([text], [400, 400], 1000, 4)).toBeNull()
    const dot: Mark = { id: 'd', kind: 'pen', color: '#000', size: 'S', points: [[5, 5]] }
    expect(hitTest([dot], [6, 5], 1000, 4)).toBe('d')
  })
})

// A canvas stand-in that records the calls made on it and the properties set on it
function fakeCtx() {
  const calls: string[] = []
  const state: Record<string, unknown> = {}
  const ctx = new Proxy(state, {
    get: (t, k: string) => (k in t ? t[k] : (...a: unknown[]) => { calls.push(`${k}(${a.map(x => (typeof x === 'number' ? Math.round(x) : typeof x === 'object' ? 'obj' : String(x))).join(',')})`) }),
    set: (t, k: string, v) => { t[k] = v; if (k === 'globalAlpha') calls.push(`alpha=${v}`); return true },
  })
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, state }
}

describe('drawing marks', () => {
  it('draws a pen mark as a path through its points, in its colour and a width that grows with the size', () => {
    const { ctx, calls, state } = fakeCtx()
    drawMark(ctx, { id: 'p', kind: 'pen', color: '#dc2626', size: 'L', points: [[0, 0], [10, 10], [20, 5]] }, 1200)
    expect(calls).toContain('moveTo(0,0)'); expect(calls).toContain('lineTo(20,5)'); expect(calls).toContain('stroke()')
    expect(state.strokeStyle).toBe('#dc2626')
    expect(strokeWidth('L', 1200)).toBeGreaterThan(strokeWidth('S', 1200))
    expect(state.lineWidth).toBe(strokeWidth('L', 1200))
  })
  it('draws the highlighter see-through and thicker than a pen', () => {
    const { ctx, calls, state } = fakeCtx()
    drawMark(ctx, { id: 'h', kind: 'highlighter', color: '#ea580c', size: 'S', points: [[0, 0], [50, 0]] }, 1200)
    expect(calls.some(c => c.startsWith('alpha=0.3'))).toBe(true)
    expect(Number(state.lineWidth)).toBeGreaterThan(strokeWidth('S', 1200))
  })
  it('draws an arrow with a head, a rectangle and an ellipse, and text at its place', () => {
    const cases: [Mark, string][] = [
      [{ id: 'a', kind: 'arrow', color: '#000', size: 'M', from: [0, 0], to: [100, 0] }, 'lineTo'],
      [{ id: 'r', kind: 'rect', color: '#000', size: 'M', from: [100, 80], to: [10, 20] }, 'strokeRect(10,20,90,60)'],
      [{ id: 'e', kind: 'ellipse', color: '#000', size: 'M', from: [0, 0], to: [100, 50] }, 'ellipse(50,25,50,25,0,0,6)'],
      [{ id: 't', kind: 'text', color: '#000', size: 'M', at: [30, 40], text: 'ATP' }, 'fillText(ATP,30,40)'],
    ]
    for (const [mark, expected] of cases) {
      const { ctx, calls } = fakeCtx()
      drawMark(ctx, mark, 1200)
      expect(calls.some(c => c.startsWith(expected))).toBe(true)
    }
    const { ctx, calls } = fakeCtx()
    drawMark(ctx, cases[0][0], 1200)
    expect(calls.filter(c => c.startsWith('lineTo')).length).toBe(3) // the shaft and the two sides of the head
    expect(textSize('L', 1200)).toBeGreaterThan(textSize('S', 1200))
  })
})

describe('flatten', () => {
  it('draws a white page, the picture and every mark, then saves a WebP', async () => {
    const { ctx, calls } = fakeCtx()
    const toBlob = vi.fn((cb: BlobCallback, type?: string, q?: number) => { expect([type, q]).toEqual(['image/webp', 0.85]); cb(new Blob(['x'], { type: 'image/webp' })) })
    const canvas = { getContext: () => ctx, toBlob } as unknown as HTMLCanvasElement
    const blob = await flatten({} as CanvasImageSource, 800, 600, [pen('a')], () => canvas)
    expect(blob.type).toBe('image/webp')
    expect(calls[0]).toBe('fillRect(0,0,800,600)')
    expect(calls).toContain('drawImage(obj,0,0,800,600)')
    expect(calls).toContain('stroke()')
  })
  it('leaves out the picture for a blank page, and says so when the file cannot be made', async () => {
    const { ctx, calls } = fakeCtx()
    const canvas = { getContext: () => ctx, toBlob: (cb: BlobCallback) => cb(null) } as unknown as HTMLCanvasElement
    await expect(flatten(null, 10, 10, [], () => canvas)).rejects.toThrow('could not save')
    expect(calls.some(c => c.startsWith('drawImage'))).toBe(false)
  })
})
