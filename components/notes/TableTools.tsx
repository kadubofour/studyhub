'use client'
import type { Editor } from '@tiptap/core'

/** Row / column controls shown while the cursor is inside a table. */
export function TableTools({ editor }: { editor: Editor }) {
  const tools: [string, () => boolean][] = [
    ['Add row above', () => editor.chain().focus().addRowBefore().run()],
    ['Add row below', () => editor.chain().focus().addRowAfter().run()],
    ['Delete row', () => editor.chain().focus().deleteRow().run()],
    ['Add column left', () => editor.chain().focus().addColumnBefore().run()],
    ['Add column right', () => editor.chain().focus().addColumnAfter().run()],
    ['Delete column', () => editor.chain().focus().deleteColumn().run()],
    ['Header row', () => editor.chain().focus().toggleHeaderRow().run()],
  ]
  return (
    <div role="toolbar" aria-label="Table" className="flex flex-wrap items-center gap-1 rounded-xl bg-surface px-1.5 py-1 text-xs">
      <span className="px-1 font-medium text-muted">Table</span>
      {tools.map(([label, run]) => (
        <button key={label} type="button" className="rounded-lg px-2 py-1 hover:bg-raised" onClick={run}>{label}</button>
      ))}
      <button type="button" className="rounded-lg px-2 py-1 text-danger hover:bg-raised" onClick={() => editor.chain().focus().deleteTable().run()}>Delete table</button>
    </div>
  )
}
