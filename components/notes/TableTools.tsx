'use client'
import type { Editor } from '@tiptap/core'
import {
  BetweenHorizontalEnd, BetweenHorizontalStart, BetweenVerticalEnd, BetweenVerticalStart, Grid2x2X,
  PanelTopDashed, TableColumnsSplit, TableRowsSplit, type LucideIcon,
} from 'lucide-react'

/**
 * Row / column controls shown in the toolbar row while the cursor is inside a table.
 * Icon buttons on the same line, so showing them never pushes the note down.
 */
export function TableTools({ editor }: { editor: Editor }) {
  const tools: [string, LucideIcon, () => boolean, boolean?][] = [
    ['Add row above', BetweenHorizontalStart, () => editor.chain().focus().addRowBefore().run()],
    ['Add row below', BetweenHorizontalEnd, () => editor.chain().focus().addRowAfter().run()],
    ['Delete row', TableRowsSplit, () => editor.chain().focus().deleteRow().run()],
    ['Add column left', BetweenVerticalStart, () => editor.chain().focus().addColumnBefore().run()],
    ['Add column right', BetweenVerticalEnd, () => editor.chain().focus().addColumnAfter().run()],
    ['Delete column', TableColumnsSplit, () => editor.chain().focus().deleteColumn().run()],
    ['Header row', PanelTopDashed, () => editor.chain().focus().toggleHeaderRow().run()],
    ['Delete table', Grid2x2X, () => editor.chain().focus().deleteTable().run(), true],
  ]
  return (
    <div role="toolbar" aria-label="Table" className="flex shrink-0 items-center gap-0.5 rounded-lg bg-accent-soft px-1">
      {tools.map(([label, Icon, run, danger]) => (
        <button key={label} type="button" aria-label={label} title={label} onClick={run}
          className={`rounded p-1.5 hover:bg-raised ${danger ? 'text-danger' : 'text-accent'}`}><Icon size={16} aria-hidden /></button>
      ))}
    </div>
  )
}
