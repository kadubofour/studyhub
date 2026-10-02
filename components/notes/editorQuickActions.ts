import type { Editor } from '@tiptap/core'
import {
  Bold, ClipboardPaste, Columns3, Copy, Heading2, Italic, Rows3, Scissors, Sigma, Table, Trash2,
} from 'lucide-react'
import type { MenuEntry } from '@/components/ui/ContextMenu'
import type { EditMath } from './extensions'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const mod = (k: string) => (isMac ? `⌘${k}` : `Ctrl+${k}`)

/**
 * The rich editor's right-click quick actions for where the student clicked:
 * on an equation, inside a table, or in ordinary text.
 */
export function editorQuickActions(editor: Editor, at: { mathPos: number | null }, h: {
  onInsertEquation: () => void; onEditMath: EditMath; onPasteFailed: () => void
}): MenuEntry[] {
  const run = (fn: (c: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) => () => { fn(editor.chain().focus()).run() }
  const empty = editor.state.selection.empty
  const items: MenuEntry[] = []

  const math = at.mathPos === null ? null : editor.state.doc.nodeAt(at.mathPos)
  if (math && (math.type.name === 'inlineMath' || math.type.name === 'blockMath')) {
    const pos = at.mathPos!
    items.push({ label: 'Edit equation', icon: Sigma, onSelect: () => h.onEditMath(math.type.name === 'blockMath' ? 'block' : 'inline', math.attrs.latex, pos) }, 'sep')
  }

  items.push(
    // Cut/Copy go through the browser so the clipboard gets rich text too
    { label: 'Cut', icon: Scissors, shortcut: mod('X'), disabled: empty, onSelect: () => { editor.view.focus(); document.execCommand('cut') } },
    { label: 'Copy', icon: Copy, shortcut: mod('C'), disabled: empty, onSelect: () => { editor.view.focus(); document.execCommand('copy') } },
    {
      label: 'Paste', icon: ClipboardPaste, shortcut: mod('V'), onSelect: () => {
        // Reading the clipboard needs the browser's permission; if refused, point to the shortcut
        if (!navigator.clipboard?.readText) { h.onPasteFailed(); return }
        navigator.clipboard.readText()
          .then(text => { if (text) editor.chain().focus().insertContent(text).run() })
          .catch(h.onPasteFailed)
      },
    },
    'sep',
    { label: 'Bold', icon: Bold, shortcut: mod('B'), onSelect: run(c => c.toggleBold()) },
    { label: 'Italic', icon: Italic, shortcut: mod('I'), onSelect: run(c => c.toggleItalic()) },
    { label: 'Heading', icon: Heading2, onSelect: run(c => c.toggleHeading({ level: 2 })) },
    'sep',
  )

  if (editor.isActive('table')) {
    items.push(
      { label: 'Add row below', icon: Rows3, onSelect: run(c => c.addRowAfter()) },
      { label: 'Add column right', icon: Columns3, onSelect: run(c => c.addColumnAfter()) },
      { label: 'Delete row', icon: Rows3, onSelect: run(c => c.deleteRow()) },
      { label: 'Delete column', icon: Columns3, onSelect: run(c => c.deleteColumn()) },
      { label: 'Delete table', icon: Trash2, danger: true, onSelect: run(c => c.deleteTable()) },
    )
  } else {
    items.push(
      { label: 'Insert table', icon: Table, onPickTable: (rows, cols) => { editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run() } },
      { label: 'Insert equation', icon: Sigma, onSelect: h.onInsertEquation },
    )
  }
  return items
}
