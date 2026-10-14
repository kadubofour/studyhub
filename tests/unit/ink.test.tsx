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
  // The note is 500 px wide and 800 px tall, so a screen pixel is 2 ink units across
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => 500 })
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => 800 })
  HTMLCanvasElement.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, width: 500, height: 800, right: 500, bottom: 800, x: 0, y: 0, toJSON: () => ({}) })
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const line: Mark = { id: 'a', kind: 'line', color: '#dc2626', size: 'M', from: [0, 0], to: [100, 0] }

describe('reading ink back from the database', () => {
  it('keeps good marks and leaves out anything malformed', () => {
    const good = { id: 'p', kind: 'pen', color: '#111827', size: 'S', points: [[1, 2], [3, 4]] }
    const out = sanitizeInk([good, line, null, 'x', { ...good, id: 'bad1', kind: 'sword' }, { ...good, id: 'bad2', points: [[1]] }, { ...good, id: 'bad3', color: 'red' }, { id: 't', kind: 'text', color: '#000', size: 'M', at: [1, 1], text: '' }])
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

describe('the ink layer on a note', () => {
  it('shows what was drawn but does not take the pointer when not drawing', async () => {
    await act(async () => { render(<InkLayer marks={[line]} active={false} />) })
    const c = document.querySelector('canvas[data-ink]')!
    expect(c.className).toContain('pointer-events-none')
    expect(screen.queryByRole('group', { name: 'Draw on the note' })).toBeNull()
    await waitFor(() => expect(calls).toContain('lineTo(100,0)'))
  })
  it('draws a pen stroke where the pointer goes, in the note\'s space, and hands the marks to the note', async () => {
    const onChange = vi.fn()
    await act(async () => { render(<InkLayer marks={[]} active onChange={onChange} />) })
    const c = document.querySelector('canvas[data-ink]')!
    fireEvent.pointerDown(c, { clientX: 50, clientY: 50, pointerId: 1 })
    fireEvent.pointerMove(c, { clientX: 100, clientY: 80, pointerId: 1, buttons: 1 })
    fireEvent.pointerMove(c, { clientX: 150, clientY: 60, pointerId: 1, buttons: 1 })
    fireEvent.pointerUp(c, { pointerId: 1 })
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1))
    const mark = (onChange.mock.calls[0][0] as unknown[])[0] as { kind: string; points: number[][] }
    expect(mark.kind).toBe('pen')
    expect(mark.points).toEqual([[100, 100], [200, 160], [300, 120]]) // 500 px wide -> 1000 units
  })
  it('undoes with the button and with Ctrl+Z, and Done and Escape stop drawing', async () => {
    const onChange = vi.fn(), onDone = vi.fn()
    await act(async () => { render(<InkLayer marks={[]} active onChange={onChange} onDone={onDone} />) })
    const c = document.querySelector('canvas[data-ink]')!
    const stroke = () => { fireEvent.pointerDown(c, { clientX: 10, clientY: 10, pointerId: 1 }); fireEvent.pointerMove(c, { clientX: 90, clientY: 90, pointerId: 1, buttons: 1 }); fireEvent.pointerUp(c, { pointerId: 1 }) }
    stroke(); stroke()
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(expect.arrayContaining([expect.anything(), expect.anything()])))
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith([expect.anything()]))
    fireEvent.keyDown(document, { key: 'z', ctrlKey: true })
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith([]))
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onDone).toHaveBeenCalledTimes(2)
  })
  it('erases a whole mark by touching it', async () => {
    const onChange = vi.fn()
    await act(async () => { render(<InkLayer marks={[line, { ...line, id: 'b', from: [0, 600], to: [100, 600] }]} active onChange={onChange} />) })
    fireEvent.click(screen.getByRole('button', { name: 'Eraser' }))
    const c = document.querySelector('canvas[data-ink]')!
    fireEvent.pointerDown(c, { clientX: 25, clientY: 1, pointerId: 1 }) // 50 units across, on the first line
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ id: 'b' })]))
  })
  it('does not draw when it is not active', async () => {
    const onChange = vi.fn()
    await act(async () => { render(<InkLayer marks={[]} active={false} onChange={onChange} />) })
    const c = document.querySelector('canvas[data-ink]')!
    fireEvent.pointerDown(c, { clientX: 10, clientY: 10, pointerId: 1 }); fireEvent.pointerMove(c, { clientX: 90, clientY: 90, pointerId: 1, buttons: 1 }); fireEvent.pointerUp(c, { pointerId: 1 })
    expect(onChange).not.toHaveBeenCalled()
  })
})
