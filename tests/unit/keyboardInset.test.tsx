// @vitest-environment jsdom
import fs from 'node:fs'
import { describe, it, expect, afterEach } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { useKeyboardInset } from '@/lib/ui/keyboardInset'

// A stand-in for the browser's visual viewport: the part of the window not covered by the keyboard
function fakeViewport(height: number) {
  const listeners = new Set<() => void>()
  const vv = { height, offsetTop: 0, addEventListener: (_t: string, f: () => void) => listeners.add(f), removeEventListener: (_t: string, f: () => void) => listeners.delete(f) }
  Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: 844, configurable: true })
  return { open: (h: number) => { vv.height = h; listeners.forEach(f => f()) }, listeners }
}
function Probe() { return <span data-testid="inset">{useKeyboardInset()}</span> }
afterEach(cleanup)

describe('the keyboard inset', () => {
  it('is 0 with no keyboard, the keyboard\'s height while it is up, and 0 again when it closes', () => {
    const kb = fakeViewport(844)
    render(<Probe />)
    expect(screen.getByTestId('inset').textContent).toBe('0')
    act(() => kb.open(500))
    expect(screen.getByTestId('inset').textContent).toBe('344')
    act(() => kb.open(844))
    expect(screen.getByTestId('inset').textContent).toBe('0')
  })
  it('stops listening when the editor closes', () => {
    const kb = fakeViewport(844)
    const { unmount } = render(<Probe />)
    expect(kb.listeners.size).toBe(1)
    unmount()
    expect(kb.listeners.size).toBe(0)
  })
})

describe('the note\'s tools on a phone', () => {
  it('are a bar along the bottom lifted by the keyboard, and pressing one keeps the focus in the note', () => {
    const src = fs.readFileSync('components/notes/RichEditor.tsx', 'utf8')
    expect(src).toContain("role=\"toolbar\" aria-label={typing ? 'Formatting' : 'Note tools'}")
    expect(src).toContain('style={{ bottom: keyboard }}')
    expect(src).toContain('onMouseDown={e => { if (e.target !== e.currentTarget) e.preventDefault() }}')
    expect(src).toContain('{!drawing && showsPhone(screen) && <PhoneBar') // the drawing tools take its place
  })
  it('show the formatting tools while writing, Samsung Notes\' way, and a few quiet ones otherwise', () => {
    const src = fs.readFileSync('components/notes/RichEditor.tsx', 'utf8')
    const typing = src.slice(src.indexOf('{typing ? <>'), src.indexOf('</> : <>'))
    for (const t of ['Checklist', 'Numbered list', 'Bulleted list', 'Text size', 'Bold', 'Italic', 'Underline', 'Highlight', 'More']) expect(typing).toContain(`tool('${t}'`)
    const quiet = src.slice(src.indexOf('</> : <>'), src.indexOf('</>}', src.indexOf('</> : <>')))
    for (const t of ['Checklist', 'Picture', 'Draw', 'New note']) expect(quiet).toContain(`tool('${t}'`)
  })
})
