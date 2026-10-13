// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react'
import { ImageMarkup, type MarkupSource } from '@/components/notes/ImageMarkup'

// jsdom has no canvas or picture loading, so both are stood in for: a recording canvas and an Image that loads at once
const calls: string[] = []
const ctx = new Proxy({} as Record<string, unknown>, {
  get: (t, k: string) => (k in t ? t[k] : (...a: unknown[]) => { calls.push(`${k}(${a.map(x => (typeof x === 'number' ? Math.round(x) : typeof x === 'object' ? 'obj' : String(x))).join(',')})`) }),
  set: (t, k: string, v) => { t[k] = v; return true },
})
let failLoad = false
class FakeImage {
  crossOrigin = ''; naturalWidth = 600; naturalHeight = 400; onload: (() => void) | null = null; onerror: (() => void) | null = null
  set src(_v: string) { queueMicrotask(() => (failLoad ? this.onerror?.() : this.onload?.())) }
}
beforeEach(() => {
  calls.length = 0; failLoad = false
  vi.stubGlobal('Image', FakeImage)
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) { this.removeAttribute('open') }
  HTMLCanvasElement.prototype.getContext = (() => ctx) as never
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) { cb(new Blob(['x'], { type: 'image/webp' })) }
  // The canvas is shown at its own size, so a screen pixel is a picture pixel
  HTMLCanvasElement.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, width: 600, height: 400, right: 600, bottom: 400, x: 0, y: 0, toJSON: () => ({}) })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const open = async (source: MarkupSource = { url: 'https://s.test/p.webp' }, over: Partial<{ onDone: (b: Blob) => void; onCancel: () => void }> = {}) => {
  const onDone = over.onDone ?? vi.fn(), onCancel = over.onCancel ?? vi.fn()
  await act(async () => { render(<ImageMarkup open title="Markup" source={source} onCancel={onCancel} onDone={onDone} />) })
  return { onDone, onCancel, canvas: await screen.findByLabelText('Picture being marked up') }
}
const stroke = (canvas: HTMLElement, from: [number, number], to: [number, number]) => {
  fireEvent.pointerDown(canvas, { clientX: from[0], clientY: from[1], pointerId: 1 })
  fireEvent.pointerMove(canvas, { clientX: (from[0] + to[0]) / 2, clientY: (from[1] + to[1]) / 2, pointerId: 1, buttons: 1 })
  fireEvent.pointerMove(canvas, { clientX: to[0], clientY: to[1], pointerId: 1, buttons: 1 })
  fireEvent.pointerUp(canvas, { clientX: to[0], clientY: to[1], pointerId: 1 })
}

describe('the markup tool', () => {
  it('opens on the picture with the tools, six colours and three sizes', async () => {
    await open()
    for (const n of ['Pen', 'Highlighter', 'Line', 'Arrow', 'Rectangle', 'Ellipse', 'Text', 'Eraser', 'Undo', 'Redo', 'Clear all']) expect(screen.getByRole('button', { name: n })).toBeTruthy()
    expect(screen.getAllByRole('radio').length).toBe(6 + 3)
    expect(screen.getByRole('radio', { name: 'Medium' }).getAttribute('aria-checked')).toBe('true')
    expect(calls).toContain('drawImage(obj,0,0,600,400)')
  })
  it('draws a pen stroke, and Undo and Redo take it off and put it back', async () => {
    const { canvas } = await open()
    expect(screen.getByRole('button', { name: 'Undo' }).hasAttribute('disabled')).toBe(true)
    calls.length = 0
    stroke(canvas, [10, 10], [100, 60])
    await waitFor(() => expect(calls).toContain('lineTo(100,60)'))
    expect(screen.getByRole('button', { name: 'Undo' }).hasAttribute('disabled')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    calls.length = 0
    fireEvent.click(screen.getByRole('button', { name: 'Redo' })) // redone: drawn again
    await waitFor(() => expect(calls).toContain('lineTo(100,60)'))
  })
  it('draws a shape by dragging, and a click without a drag draws no line', async () => {
    const { canvas } = await open()
    fireEvent.click(screen.getByRole('button', { name: 'Rectangle' }))
    calls.length = 0
    stroke(canvas, [20, 30], [120, 90])
    await waitFor(() => expect(calls).toContain('strokeRect(20,30,100,60)'))
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }))
    fireEvent.click(screen.getByRole('button', { name: 'Line' }))
    fireEvent.pointerDown(canvas, { clientX: 5, clientY: 5, pointerId: 1 }); fireEvent.pointerUp(canvas, { pointerId: 1 })
    expect(screen.getByRole('button', { name: 'Clear all' }).hasAttribute('disabled')).toBe(true)
  })
  it('places the typed text where the picture is clicked', async () => {
    const { canvas } = await open()
    fireEvent.click(screen.getByRole('button', { name: 'Text' }))
    fireEvent.change(screen.getByLabelText('Text to place'), { target: { value: 'Mitochondria' } })
    calls.length = 0
    fireEvent.pointerDown(canvas, { clientX: 50, clientY: 40, pointerId: 1 })
    await waitFor(() => expect(calls).toContain('fillText(Mitochondria,50,40)'))
    expect((screen.getByLabelText('Text to place') as HTMLInputElement).value).toBe('')
  })
  it('erases a whole mark by touching it, and leaves the rest', async () => {
    const { canvas } = await open()
    fireEvent.click(screen.getByRole('button', { name: 'Line' }))
    stroke(canvas, [10, 10], [200, 10])
    stroke(canvas, [10, 200], [200, 200])
    fireEvent.click(screen.getByRole('button', { name: 'Eraser' }))
    calls.length = 0
    fireEvent.pointerDown(canvas, { clientX: 100, clientY: 12, pointerId: 1 })
    fireEvent.pointerUp(canvas, { pointerId: 1 })
    await waitFor(() => expect(calls).not.toContain('lineTo(200,10)'))
    expect(calls).toContain('lineTo(200,200)')
  })
  it('uses the chosen colour', async () => {
    const { canvas } = await open()
    fireEvent.click(screen.getByRole('radio', { name: 'Blue' }))
    stroke(canvas, [10, 10], [60, 60])
    await waitFor(() => expect(calls.length).toBeGreaterThan(0))
    // the last mark drawn is blue: the stand-in keeps the final style set on it
    expect((ctx as unknown as Record<string, unknown>).strokeStyle).toBe('#2563eb')
  })
  it('Done hands back the flattened picture; Cancel hands back nothing', async () => {
    const onDone = vi.fn(), onCancel = vi.fn()
    await open(undefined, { onDone, onCancel })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Done' })) })
    expect(onDone).toHaveBeenCalledTimes(1)
    expect((onDone.mock.calls[0][0] as Blob).type).toBe('image/webp')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
  })
  it('says so when saving fails, and lets the student try again', async () => {
    const onDone = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined)
    await open(undefined, { onDone })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Done' })) })
    expect((await screen.findByRole('alert')).textContent).toMatch(/couldn.t save/i)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Done' })) })
    expect(onDone).toHaveBeenCalledTimes(2)
  })
  it('opens a blank white page for a sketch', async () => {
    await open({ blank: true })
    expect(calls).toContain('fillRect(0,0,1200,800)')
    expect(calls.some(c => c.startsWith('drawImage'))).toBe(false)
  })
  it('says so when the picture cannot be opened, and cannot be saved', async () => {
    failLoad = true
    await act(async () => { render(<ImageMarkup open title="Markup" source={{ url: 'https://s.test/x.webp' }} onCancel={() => {}} onDone={() => {}} />) })
    expect((await screen.findByRole('alert')).textContent).toMatch(/could not be opened/i)
    expect(screen.getByRole('button', { name: 'Done' }).hasAttribute('disabled')).toBe(true)
  })
  it('undoes with Ctrl+Z', async () => {
    const { canvas } = await open()
    stroke(canvas, [10, 10], [100, 60])
    expect(screen.getByRole('button', { name: 'Undo' }).hasAttribute('disabled')).toBe(false)
    fireEvent.keyDown(canvas, { key: 'z', ctrlKey: true })
    expect(screen.getByRole('button', { name: 'Undo' }).hasAttribute('disabled')).toBe(true)
  })
})
