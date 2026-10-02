// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { Editor } from '@tiptap/core'
import { noteExtensions } from '@/components/notes/extensions'
import { findMatches, FindHighlight, findKey, highlightInElement } from '@/components/notes/findInNote'
import { EquationDialog } from '@/components/notes/EquationDialog'
import { TableTools } from '@/components/notes/TableTools'
import { FindBar } from '@/components/notes/FindBar'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
afterEach(cleanup)

const makeEditor = (md: string) => new Editor({ extensions: [...noteExtensions(), FindHighlight], content: md, contentType: 'markdown' })

describe('find in note', () => {
  it('finds every match, case-insensitively, and highlights them', () => {
    const editor = makeEditor('The cell membrane.\n\nEach Cell has DNA.')
    const matches = findMatches(editor.state.doc, 'cell')
    expect(matches).toHaveLength(2)
    editor.view.dispatch(editor.state.tr.setMeta(findKey, { query: 'cell', index: 1 }))
    const decos = findKey.getState(editor.state)!.decorations.find()
    expect(decos).toHaveLength(2)
    editor.destroy()
  })
  it('counts matches in rendered text, skipping equation markup, and scrolls to the current one', () => {
    const el = document.createElement('div')
    el.innerHTML = '<p>Cell walls</p><p>The <b>cell</b> <span class="katex">cell</span></p>'
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    expect(highlightInElement(el, 'CELL', 1)).toBe(2)
    expect(scroll.mock.contexts[0]).toBe(el.querySelector('b'))
    expect(highlightInElement(el, '', 0)).toBe(0)
  })
  it('finds nothing for an empty query', () => {
    const editor = makeEditor('Anything')
    expect(findMatches(editor.state.doc, '')).toEqual([])
    editor.destroy()
  })
})

describe('FindBar', () => {
  it('searches as you type, cycles with Enter / Shift+Enter, and closes on Esc', () => {
    const search = vi.fn((q: string) => (q ? 3 : 0))
    const onClose = vi.fn()
    render(<FindBar search={search} onClose={onClose} />)
    const box = screen.getByRole('searchbox', { name: 'Find in note' })
    fireEvent.change(box, { target: { value: 'cell' } })
    expect(search).toHaveBeenLastCalledWith('cell', 0)
    expect(screen.getByText('1 of 3')).toBeTruthy()
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: true })
    expect(screen.getByText('3 of 3')).toBeTruthy() // wraps backwards
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(screen.getByText('1 of 3')).toBeTruthy()
    fireEvent.keyDown(box, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
  it('says when nothing matches', () => {
    render(<FindBar search={() => 0} onClose={() => {}} />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } })
    expect(screen.getByText('No matches')).toBeTruthy()
  })
})

describe('EquationDialog', () => {
  it('previews the equation as you type and returns the LaTeX on Insert', async () => {
    const onSave = vi.fn()
    render(<EquationDialog open initial={null} onClose={() => {}} onSave={onSave} />)
    const box = screen.getByLabelText('LaTeX')
    fireEvent.change(box, { target: { value: '\\frac{a}{b}' } })
    expect(document.querySelector('.katex')).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Insert' })) })
    expect(onSave).toHaveBeenCalledWith('\\frac{a}{b}', false)
  })
  it('edits an existing equation and can switch it to its own line', async () => {
    const onSave = vi.fn()
    render(<EquationDialog open initial={{ latex: 'x^2', display: false }} onClose={() => {}} onSave={onSave} />)
    expect((screen.getByLabelText('LaTeX') as HTMLTextAreaElement).value).toBe('x^2')
    fireEvent.click(screen.getByLabelText('Show on its own line'))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Update' })) })
    expect(onSave).toHaveBeenCalledWith('x^2', true)
  })
  it('flags LaTeX that can\'t be read', () => {
    render(<EquationDialog open initial={null} onClose={() => {}} onSave={() => {}} />)
    fireEvent.change(screen.getByLabelText('LaTeX'), { target: { value: '\\frac{' } })
    expect(screen.getByRole('alert').textContent).toMatch(/can't read/i)
  })
})

describe('TableTools', () => {
  it('adds and removes rows and columns in the table the cursor is in', async () => {
    const editor = makeEditor('| A | B |\n| --- | --- |\n| 1 | 2 |')
    editor.commands.setTextSelection(3) // inside the first cell
    render(<TableTools editor={editor} />)
    const rows = () => editor.state.doc.toJSON().content![0].content.length
    const cols = () => editor.state.doc.toJSON().content![0].content![0].content.length
    expect(rows()).toBe(2)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add row below' })) })
    expect(rows()).toBe(3)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add column right' })) })
    expect(cols()).toBe(3)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Delete table' })) })
    expect(editor.getJSON().content!.some(n => n.type === 'table')).toBe(false)
    editor.destroy()
  })
})
