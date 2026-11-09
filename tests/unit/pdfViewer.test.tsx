// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'

let opened: () => Promise<unknown>
const urls: string[] = []
const getPage = vi.fn(async () => ({
  getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale, scale }),
  getTextContent: async () => ({ items: [{ str: 'Mitosis' }, { str: 'divides cells' }] }),
  render: () => ({ promise: new Promise(() => {}), cancel: vi.fn() }),
  streamTextContent: vi.fn(),
}))
vi.mock('@/lib/import/pdfEngine', () => ({
  pdfEngine: async () => ({ getDocument: ({ url }: { url: string }) => { urls.push(url); return { promise: opened(), destroy: async () => {} } } }),
}))
import { PdfViewer } from '@/components/files/PdfViewer'

const onePdf = (numPages = 3) => async () => ({ numPages, getPage })
const show = async (onExplain?: (p: unknown) => void) => { await act(async () => { render(<PdfViewer url="https://x/a.pdf?token=t" name="a.pdf" onExplain={onExplain} />) }) }
const BUBBLE = 'Ask the tutor to explain the selected text'
const select = (text: string, anchorNode: Node) => {
  vi.spyOn(document, 'getSelection').mockReturnValue({
    toString: () => text, anchorNode, rangeCount: 1, getRangeAt: () => ({ getBoundingClientRect: () => ({ left: 10, right: 60, top: 0, bottom: 0 }) }),
  } as unknown as Selection)
  act(() => { document.dispatchEvent(new Event('selectionchange')) })
}

beforeEach(() => {
  urls.length = 0
  opened = onePdf()
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('ResizeObserver', class {
    constructor(private cb: ResizeObserverCallback) {}
    observe() { this.cb([{ contentRect: { width: 600 } } as ResizeObserverEntry], this as unknown as ResizeObserver) }
    disconnect() {}
  })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('the PDF viewer', () => {
  it('lays out every page and says how many there are', async () => {
    await show()
    expect(screen.getByText('Page 1 of 3')).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Page 3' })).toBeTruthy()
  })

  it('zooms within its limits', async () => {
    await show()
    const page = () => (screen.getByRole('group', { name: 'Page 1' }) as HTMLElement).style.width
    expect(page()).toBe('600px')
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(page()).toBe('750px')
    fireEvent.click(screen.getByRole('button', { name: 'Back to full width' }))
    expect(page()).toBe('600px')
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }))
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }))
    expect((screen.getByRole('button', { name: 'Zoom out' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('has no Explain button unless it is given something to do', async () => {
    await show()
    expect(screen.queryByRole('button', { name: /Explain/ })).toBeNull()
  })

  it('explains the page being read', async () => {
    const onExplain = vi.fn()
    await show(onExplain)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Explain page' })) })
    expect(onExplain).toHaveBeenCalledWith({ page: 1, text: 'Mitosis divides cells', picked: false })
  })

  it('explains the words selected in it, once there are some', async () => {
    const onExplain = vi.fn()
    await show(onExplain)
    const inPage = document.createElement('span')
    inPage.textContent = 'divides'
    screen.getByRole('group', { name: 'Page 2' }).append(inPage)
    select('divides', inPage.firstChild!)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: BUBBLE })) })
    expect(onExplain).toHaveBeenCalledWith({ page: 2, text: 'divides', picked: true })
  })

  it('does not offer it for a stray letter', async () => {
    await show(vi.fn())
    const inPage = document.createElement('span')
    inPage.textContent = 'a'
    screen.getByRole('group', { name: 'Page 1' }).append(inPage)
    select('a', inPage.firstChild!)
    expect(screen.queryByRole('button', { name: BUBBLE })).toBeNull()
  })

  it('ignores words selected elsewhere on the page', async () => {
    await show(vi.fn())
    const outside = document.createElement('p')
    outside.textContent = 'elsewhere'
    document.body.append(outside)
    select('elsewhere', outside.firstChild!)
    expect(screen.queryByRole('button', { name: BUBBLE })).toBeNull()
    outside.remove()
  })

  it('says when a PDF needs a password', async () => {
    opened = async () => { throw Object.assign(new Error('x'), { name: 'PasswordException' }) }
    await show()
    expect(screen.getByRole('alert').textContent).toMatch(/password/)
  })

  it('can try again after failing to load', async () => {
    opened = async () => { throw new Error('offline') }
    await show()
    expect(screen.getByRole('alert').textContent).toMatch(/Couldn.t show this PDF/)
    opened = onePdf(2)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Try again' })) })
    expect(screen.getByText('Page 1 of 2')).toBeTruthy()
    expect(urls).toHaveLength(2)
  })
})
