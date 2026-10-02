// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { Editor } from '@tiptap/core'
import { noteExtensions } from '@/components/notes/extensions'
import { editorQuickActions } from '@/components/notes/editorQuickActions'
import type { MenuEntry } from '@/components/ui/ContextMenu'

const labels = (items: MenuEntry[]) => items.filter(i => i !== 'sep').map(i => i.label)
const find = (items: MenuEntry[], label: string) => items.find(i => i !== 'sep' && i.label === label) as Exclude<MenuEntry, 'sep'>
const make = (md: string) => new Editor({ extensions: noteExtensions(), content: md, contentType: 'markdown' })
const handlers = () => ({ onInsertEquation: vi.fn(), onEditMath: vi.fn(), onPasteFailed: vi.fn() })

describe('editorQuickActions', () => {
  it('in ordinary text: clipboard, formatting and insert actions; Cut/Copy need a selection', () => {
    const editor = make('Hello world')
    editor.commands.setTextSelection(3)
    const items = editorQuickActions(editor, { mathPos: null }, handlers())
    expect(labels(items)).toEqual(['Cut', 'Copy', 'Paste', 'Bold', 'Italic', 'Heading', 'Insert table', 'Insert equation'])
    expect(find(items, 'Cut').disabled).toBe(true)
    editor.commands.setTextSelection({ from: 1, to: 6 })
    expect(find(editorQuickActions(editor, { mathPos: null }, handlers()), 'Copy').disabled).toBeFalsy()
    editor.destroy()
  })

  it('formatting actions apply to the selection', () => {
    const editor = make('Hello world')
    editor.commands.setTextSelection({ from: 1, to: 6 })
    const items = editorQuickActions(editor, { mathPos: null }, handlers())
    ;(find(items, 'Bold') as { onSelect: () => void }).onSelect()
    expect(editor.getMarkdown().trim()).toBe('**Hello** world')
    editor.destroy()
  })

  it('inside a table: row, column and table actions instead of insert', () => {
    const editor = make('| A | B |\n| --- | --- |\n| 1 | 2 |')
    editor.commands.setTextSelection(3)
    const items = editorQuickActions(editor, { mathPos: null }, handlers())
    expect(labels(items)).toEqual(expect.arrayContaining(['Add row below', 'Add column right', 'Delete row', 'Delete column', 'Delete table']))
    expect(labels(items)).not.toContain('Insert table')
    ;(find(items, 'Add row below') as { onSelect: () => void }).onSelect()
    expect(editor.state.doc.toJSON().content[0].content.length).toBe(3)
    editor.destroy()
  })

  it('on an equation: Edit equation comes first and opens it', () => {
    const editor = make('Area $x^2$ here')
    let mathPos = -1
    editor.state.doc.descendants((n, pos) => { if (n.type.name === 'inlineMath') mathPos = pos })
    const h = handlers()
    const items = editorQuickActions(editor, { mathPos }, h)
    expect(labels(items)[0]).toBe('Edit equation')
    ;(find(items, 'Edit equation') as { onSelect: () => void }).onSelect()
    expect(h.onEditMath).toHaveBeenCalledWith('inline', 'x^2', mathPos)
    editor.destroy()
  })
})
