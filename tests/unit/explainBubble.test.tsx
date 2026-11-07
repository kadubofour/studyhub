// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { Editor } from '@tiptap/core'
import { noteExtensions } from '@/components/notes/extensions'
import { ExplainBubble, selectedPassage } from '@/components/notes/ExplainBubble'

let editor: Editor
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => { cb(); return 1 })
  vi.stubGlobal('cancelAnimationFrame', () => {})
  editor = new Editor({ extensions: noteExtensions(), content: 'Hello brave world', contentType: 'markdown' })
  // jsdom has no layout: give the editor somewhere to say a selection is
  ;(editor.view as unknown as { coordsAtPos: () => object }).coordsAtPos = () => ({ left: 100, right: 140, top: 200, bottom: 220 })
})
afterEach(() => { cleanup(); editor.destroy(); vi.unstubAllGlobals() })
const select = (from: number, to: number) => act(() => { editor.commands.setTextSelection({ from, to }) })

describe('the Explain button by selected text', () => {
  it('reads the selected passage, and nothing for a cursor or a stray letter', () => {
    editor.commands.setTextSelection({ from: 7, to: 12 })
    expect(selectedPassage(editor)).toBe('brave')
    editor.commands.setTextSelection(3)
    expect(selectedPassage(editor)).toBe('')
    editor.commands.setTextSelection({ from: 1, to: 2 })
    expect(selectedPassage(editor)).toBe('')
  })
  it('appears when text is selected and goes when it is not, and asks for exactly that text', () => {
    const onExplain = vi.fn()
    render(<ExplainBubble editor={editor} onExplain={onExplain} />)
    expect(screen.queryByRole('button', { name: /Ask the tutor to explain/ })).toBeNull()
    select(7, 12)
    fireEvent.click(screen.getByRole('button', { name: /Ask the tutor to explain/ }))
    expect(onExplain).toHaveBeenCalledWith('brave')
    select(3, 3)
    expect(screen.queryByRole('button', { name: /Ask the tutor to explain/ })).toBeNull()
  })
  it('does not take the press from the note, so the selection stays', () => {
    render(<ExplainBubble editor={editor} onExplain={() => {}} />)
    select(7, 12)
    const button = screen.getByRole('button', { name: /Ask the tutor to explain/ })
    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    act(() => { button.dispatchEvent(down) })
    expect(down.defaultPrevented).toBe(true)
  })
  it('can be hidden (while drawing or a menu is open), and sits below the selection on a phone', () => {
    const { rerender } = render(<ExplainBubble editor={editor} onExplain={() => {}} hidden />)
    select(7, 12)
    expect(screen.queryByRole('button', { name: /Ask the tutor to explain/ })).toBeNull()
    rerender(<ExplainBubble editor={editor} onExplain={() => {}} below />)
    select(8, 12)
    expect(parseFloat((screen.getByRole('button', { name: /Ask the tutor to explain/ }) as HTMLElement).style.top)).toBeGreaterThan(220) // under it, not over
  })
})
