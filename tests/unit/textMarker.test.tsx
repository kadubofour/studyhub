// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { Editor } from '@tiptap/core'
import { noteExtensions } from '@/components/notes/extensions'
import { MarkerLayer } from '@/components/notes/MarkerLayer'
import { applyMarker, wordRange } from '@/components/notes/textMarker'

const editors: Editor[] = []
const make = (md: string) => {
  const e = new Editor({ extensions: noteExtensions(), content: md, contentType: 'markdown' })
  editors.push(e)
  return e
}
afterEach(() => { cleanup(); while (editors.length) editors.pop()!.destroy() })

// jsdom has no layout, so a pointer's x position stands for the document position it is over
const overPositions = (e: Editor) => { e.view.posAtCoords = (c: { left: number }) => ({ pos: c.left, inside: -1 }) }
const mount = async (md: string, onDone = vi.fn()) => {
  const e = make(md)
  overPositions(e)
  await act(async () => { render(<MarkerLayer editor={e} active onDone={onDone}><div data-testid="page">page</div></MarkerLayer>) })
  return { e, onDone, page: screen.getByTestId('page').parentElement! }
}
const drag = (el: Element, from: number, to: number) => {
  fireEvent.pointerDown(el, { clientX: from, clientY: 5, pointerId: 1 })
  fireEvent.pointerMove(el, { clientX: Math.round((from + to) / 2), clientY: 5, pointerId: 1 })
  fireEvent.pointerMove(el, { clientX: to, clientY: 5, pointerId: 1 })
  fireEvent.pointerUp(el, { clientX: to, clientY: 5, pointerId: 1 })
}

describe('the word under a position', () => {
  it('finds the whole word, including just after it, and nothing in a gap', () => {
    const e = make('Alpha beta gamma') // the paragraph's text starts at position 1
    expect(wordRange(e.state.doc, 8)).toEqual({ from: 7, to: 11 }) // inside "beta"
    expect(wordRange(e.state.doc, 11)).toEqual({ from: 7, to: 11 }) // the edge after it
    expect(wordRange(e.state.doc, 1)).toEqual({ from: 1, to: 6 })
    const gap = make('a   b')
    expect(wordRange(gap.state.doc, 3)).toBeNull()
  })
})

describe('applying the marker', () => {
  it('highlights, underlines and strikes a range, and the eraser takes them all off', () => {
    const e = make('Alpha beta gamma')
    applyMarker(e, 'highlight', 'pink', 7, 11)
    applyMarker(e, 'underline', 'pink', 7, 11)
    applyMarker(e, 'strike', 'pink', 1, 6)
    expect(e.getMarkdown()).toContain('~~Alpha~~')
    expect(e.getMarkdown()).toContain('<u><mark class="hl hl-pink">beta</mark></u>')
    applyMarker(e, 'erase', 'pink', 1, 17)
    expect(e.getMarkdown()).toBe('Alpha beta gamma')
  })
  it('does nothing for an empty range', () => {
    const e = make('Alpha')
    expect(applyMarker(e, 'highlight', 'yellow', 3, 3)).toBe(false)
    expect(e.getMarkdown()).toBe('Alpha')
  })
})

describe('dragging the marker across the text', () => {
  it('highlights the words the drag covers, in the chosen colour', async () => {
    const { e, page } = await mount('Alpha beta gamma')
    fireEvent.click(screen.getByRole('radio', { name: 'Green marker' }))
    drag(page, 7, 17)
    expect(e.getMarkdown()).toBe('Alpha <mark class="hl hl-green">beta gamma</mark>')
  })
  it('works backwards too, from the end of the words to the start', async () => {
    const { e, page } = await mount('Alpha beta gamma')
    drag(page, 17, 7)
    expect(e.getMarkdown()).toContain('<mark class="hl hl-yellow">beta gamma</mark>')
  })
  it('marks the word that is clicked', async () => {
    const { e, page } = await mount('Alpha beta gamma')
    fireEvent.click(screen.getByRole('button', { name: 'Underline' }))
    drag(page, 9, 9)
    expect(e.getMarkdown()).toBe('Alpha <u>beta</u> gamma')
  })
  it('strikes through, and the eraser clears what it is dragged over', async () => {
    const { e, page } = await mount('Alpha beta gamma')
    fireEvent.click(screen.getByRole('button', { name: 'Strikethrough' }))
    drag(page, 1, 17)
    expect(e.getMarkdown()).toBe('~~Alpha beta gamma~~')
    fireEvent.click(screen.getByRole('button', { name: 'Remove markup' }))
    drag(page, 7, 11)
    expect(e.getMarkdown()).toBe('~~Alpha~~ beta ~~gamma~~')
  })
  it('keeps the marks with the words when the text around them changes', async () => {
    const { e, page } = await mount('Alpha beta gamma')
    drag(page, 7, 11)
    e.setEditable(true)
    e.commands.insertContentAt(1, 'New words first. ')
    expect(e.getMarkdown()).toBe('New words first. Alpha <mark class="hl hl-yellow">beta</mark> gamma')
  })
  it('turns typing off while marking and back on after Done', async () => {
    const onDone = vi.fn()
    const { e } = await mount('Alpha', onDone)
    expect(e.isEditable).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onDone).toHaveBeenCalledTimes(2)
    cleanup()
    expect(e.isEditable).toBe(true)
  })
  it('does nothing when the marker is off', async () => {
    const e = make('Alpha beta')
    overPositions(e)
    await act(async () => { render(<MarkerLayer editor={e} active={false} onDone={() => {}}><div data-testid="page">page</div></MarkerLayer>) })
    drag(screen.getByTestId('page').parentElement!, 1, 6)
    expect(e.getMarkdown()).toBe('Alpha beta')
    expect(screen.queryByRole('group', { name: 'Mark up the text' })).toBeNull()
  })
})
