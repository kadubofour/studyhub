// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react'
import { InkLayer } from '@/components/notes/InkLayer'
import { drawInk, sanitizeInk, INK_WIDTH } from '@/lib/markup/ink'
import type { Mark } from '@/lib/markup/marks'

const calls: string[] = []
const state: Record<string, unknown> = {}
const ctx = new Proxy(state, {
  get: (t, k: string) => (k in t ? t[k] : (...a: unknown[]) => { calls.push(`${k}(${a.map(x => (typeof x === 'number' ? Math.round(x * 100) / 100 : String(x))).join(',')})`) }),
  set: (t, k: string, v) => { t[k] = v; return true },
})
beforeEach(() => {
  calls.length = 0
  HTMLCanvasElement.prototype.getContext = (() => ctx) as never
  // The note is 500 px wide and 800 px tall, so a screen pixel is 2 units across
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => 500 })
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => 800 })
  HTMLCanvasElement.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, width: 500, height: 800, right: 500, bottom: 800, x: 0, y: 0, toJSON: () => ({}) })
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const line: Mark = { id: 'a', brush: 'pen', color: '#dc2626', width: 4, points: [[0, 0], [100, 0]] }
const canvas = () => document.querySelector('canvas[data-ink]')!
const stroke = (c: Element, from: [number, number], to: [number, number]) => {
  fireEvent.pointerDown(c, { clientX: from[0], clientY: from[1], pointerId: 1 })
  fireEvent.pointerMove(c, { clientX: (from[0] + to[0]) / 2, clientY: (from[1] + to[1]) / 2, pointerId: 1, buttons: 1 })
  fireEvent.pointerMove(c, { clientX: to[0], clientY: to[1], pointerId: 1, buttons: 1 })
  fireEvent.pointerUp(c, { pointerId: 1 })
}

describe('reading ink back from the database', () => {
  it('keeps good strokes and leaves out anything malformed', () => {
    const good = { id: 'p', brush: 'pencil', color: '#111827', width: 6.5, points: [[1, 2], [3, 4]] }
    const out = sanitizeInk([good, line, null, 'x', { ...good, id: 'b1', brush: 'sword' }, { ...good, id: 'b2', points: [[1]] }, { ...good, id: 'b3', color: 'red' }, { ...good, id: 'b4', width: 0 }, { ...good, id: 'b5', width: 99 }, { ...good, id: 'b6', points: [] }])
    expect(out.map(m => m.id)).toEqual(['p', 'a'])
  })
  it('is empty for anything that is not a list', () => {
    expect(sanitizeInk(undefined)).toEqual([])
    expect(sanitizeInk({ a: 1 })).toEqual([])
  })
})

describe('drawing ink at the width the note is shown', () => {
  it('scales the whole 1000-unit space to the note, and by the screen density', () => {
    drawInk(ctx as unknown as CanvasRenderingContext2D, [line], 500, 2)
    expect(calls[0]).toBe('save()')
    expect(calls).toContain('scale(1,1)') // 500 px / 1000 units * 2 device pixels
    expect(calls).toContain('lineTo(100,0)')
    expect(INK_WIDTH).toBe(1000)
  })
})

describe('the drawing layer on a note', () => {
  it('shows what was drawn but does not take the pointer when not drawing', async () => {
    await act(async () => { render(<InkLayer marks={[line]} active={false} />) })
    expect(canvas().className).toContain('pointer-events-none')
    expect(screen.queryByRole('group', { name: 'Draw on the note' })).toBeNull()
    await waitFor(() => expect(calls).toContain('lineTo(100,0)'))
  })
  it('does not draw when it is not active', async () => {
    const onChange = vi.fn()
    await act(async () => { render(<InkLayer marks={[]} active={false} onChange={onChange} />) })
    stroke(canvas(), [10, 10], [90, 90])
    expect(onChange).not.toHaveBeenCalled()
  })
  it('draws a stroke where the pointer goes, in the note\'s space, and hands it to the note', async () => {
    const onChange = vi.fn()
    await act(async () => { render(<InkLayer marks={[]} active onChange={onChange} />) })
    stroke(canvas(), [50, 50], [150, 60])
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1))
    const mark = (onChange.mock.calls[0][0] as Mark[])[0]
    expect(mark.brush).toBe('pen')
    expect(mark.points[0]).toEqual([100, 100]) // 500 px wide -> 1000 units
    expect(mark.points[mark.points.length - 1]).toEqual([300, 120])
  })
  it('draws with the chosen brush, colour and any thickness from the slider', async () => {
    const onChange = vi.fn()
    await act(async () => { render(<InkLayer marks={[]} active onChange={onChange} />) })
    fireEvent.click(screen.getByRole('button', { name: 'Calligraphy pen' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Blue' }))
    fireEvent.change(screen.getByRole('slider', { name: /Thickness/ }), { target: { value: '17.5' } })
    stroke(canvas(), [10, 10], [90, 90])
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    expect((onChange.mock.calls[0][0] as Mark[])[0]).toMatchObject({ brush: 'calligraphy', color: '#2563eb', width: 17.5 })
  })
  it('offers all six brushes and both erasers', async () => {
    await act(async () => { render(<InkLayer marks={[]} active />) })
    for (const n of ['Pen', 'Pencil', 'Marker', 'Highlighter', 'Calligraphy pen', 'Dotted line', 'Rub out', 'Erase whole stroke']) expect(screen.getByRole('button', { name: n })).toBeTruthy()
    expect(screen.getByRole('slider', { name: /Thickness/ }).getAttribute('min')).toBe('1')
    expect(screen.getByRole('slider', { name: /Thickness/ }).getAttribute('max')).toBe('40')
  })
  it('erases a whole stroke by touching it, and leaves the others', async () => {
    const onChange = vi.fn()
    await act(async () => { render(<InkLayer marks={[line, { ...line, id: 'b', points: [[0, 600], [100, 600]] }]} active onChange={onChange} />) })
    fireEvent.click(screen.getByRole('button', { name: 'Erase whole stroke' }))
    fireEvent.pointerDown(canvas(), { clientX: 25, clientY: 1, pointerId: 1 }) // 50 units across, on the first line
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ id: 'b' })]))
  })
  it('rubs out just the part of a stroke the rubber passes over, as one step that Undo takes back', async () => {
    const onChange = vi.fn()
    const long: Mark = { ...line, points: [[0, 0], [400, 0]] }
    await act(async () => { render(<InkLayer marks={[long]} active onChange={onChange} />) })
    fireEvent.click(screen.getByRole('button', { name: 'Rub out' }))
    fireEvent.pointerDown(canvas(), { clientX: 100, clientY: 0, pointerId: 1 }) // 200 units across, the middle
    fireEvent.pointerMove(canvas(), { clientX: 105, clientY: 0, pointerId: 1, buttons: 1 })
    fireEvent.pointerUp(canvas(), { pointerId: 1 })
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1)) // one change for the whole gesture
    const after = onChange.mock.calls[0][0] as Mark[]
    expect(after).toHaveLength(2) // the stroke is cut in two, not removed
    expect(after[0].points[0]).toEqual([0, 0])
    expect(after[1].points[after[1].points.length - 1]).toEqual([400, 0])
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith([long]))
  })
  it('a bigger rubber takes away more', async () => {
    const onChange = vi.fn()
    await act(async () => { render(<InkLayer marks={[{ ...line, points: [[0, 0], [400, 0]] }]} active onChange={onChange} />) })
    fireEvent.click(screen.getByRole('button', { name: 'Rub out' }))
    fireEvent.change(screen.getByRole('slider', { name: /Rubber size/ }), { target: { value: '40' } })
    fireEvent.pointerDown(canvas(), { clientX: 100, clientY: 0, pointerId: 1 })
    fireEvent.pointerUp(canvas(), { pointerId: 1 })
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    const [a, b] = onChange.mock.calls[0][0] as Mark[]
    expect(b.points[0][0] - a.points[a.points.length - 1][0]).toBeGreaterThan(90) // radius 52 each side of x = 200
  })
  it('undoes with the button and with Ctrl+Z, and Done and Escape stop drawing', async () => {
    const onChange = vi.fn(), onDone = vi.fn()
    await act(async () => { render(<InkLayer marks={[]} active onChange={onChange} onDone={onDone} />) })
    stroke(canvas(), [10, 10], [90, 90]); stroke(canvas(), [10, 20], [90, 100])
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(expect.arrayContaining([expect.anything(), expect.anything()])))
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith([expect.anything()]))
    fireEvent.keyDown(document, { key: 'z', ctrlKey: true })
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith([]))
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onDone).toHaveBeenCalledTimes(2)
  })
})
