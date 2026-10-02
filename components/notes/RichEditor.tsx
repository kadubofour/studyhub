'use client'
import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import { Bold, Italic, Heading2, List, ListChecks, Code, Sigma, Table } from 'lucide-react'
import { noteExtensions, type EditMath } from './extensions'
import { FindHighlight } from './findInNote'
import { TableTools } from './TableTools'
import { TableGridPicker } from './TableGridPicker'

export const insertTable = (editor: Editor, rows: number, cols: number) =>
  editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run()

// Toolbar Table button: opens the size grid in a small popover
function TableButton({ editor, on }: { editor: Editor; on: boolean }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  return (
    <div ref={wrap} className="relative">
      <button ref={button} type="button" aria-label="Table" title="Table" aria-haspopup="dialog" aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className={`rounded p-1.5 ${on || open ? 'bg-surface text-fg' : 'text-muted hover:text-fg'}`}><Table size={16} aria-hidden /></button>
      {open && (
        <div role="dialog" aria-label="Insert table" className="menu-panel right-0 origin-top-right sm:left-0 sm:right-auto sm:origin-top-left">
          <TableGridPicker autoFocus onPick={(r, c) => { setOpen(false); insertTable(editor, r, c) }}
            onCancel={() => { setOpen(false); button.current?.focus() }} />
        </div>
      )}
    </div>
  )
}

export function RichEditor({ markdown, onChange, onReady, onEditMath, onInsertEquation }: {
  markdown: string
  onChange: (md: string) => void
  /** Hands the editor to the page (menu bar commands, find); null when it goes away. */
  onReady?: (editor: Editor | null) => void
  /** Clicking an equation opens it for editing. Must only call stable setters: it is read once. */
  onEditMath?: EditMath
  onInsertEquation?: () => void
}) {
  // Built once: a new array each render would make Tiptap reconfigure the editor every time
  const [extensions] = useState(() => [...noteExtensions({ onEditMath }), FindHighlight])
  const editor = useEditor({
    extensions,
    content: markdown,
    contentType: 'markdown',
    immediatelyRender: false,
    // Re-render on every change so the toolbar's on/off states and table controls follow the cursor
    shouldRerenderOnTransaction: true,
    editorProps: { attributes: { class: 'prose-note min-h-[50vh] outline-none py-3', 'aria-label': 'Note' } },
    onUpdate: ({ editor }) => onChange(editor.getMarkdown()),
  })

  useEffect(() => {
    if (!editor) return
    onReady?.(editor)
    return () => onReady?.(null)
  }, [editor, onReady])

  if (!editor) return null
  const active = (name: string) => editor.isActive(name)

  const tool = (label: string, Icon: typeof Bold, run: () => void, on = false) => (
    <button type="button" aria-label={label} title={label} onClick={run} aria-pressed={on}
      className={`rounded p-1.5 ${on ? 'bg-surface text-fg' : 'text-muted hover:text-fg'}`}><Icon size={16} aria-hidden /></button>
  )

  return (
    <div>
      <div className="sticky top-[57px] z-20 -mx-2 flex flex-wrap items-center gap-0.5 border-b border-line bg-bg/95 px-2 pb-1.5 pt-1 backdrop-blur">
        {tool('Bold', Bold, () => editor.chain().focus().toggleBold().run(), active('bold'))}
        {tool('Italic', Italic, () => editor.chain().focus().toggleItalic().run(), active('italic'))}
        {tool('Heading', Heading2, () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active('heading'))}
        {tool('Bulleted list', List, () => editor.chain().focus().toggleBulletList().run(), active('bulletList'))}
        {tool('Checklist', ListChecks, () => editor.chain().focus().toggleTaskList().run(), active('taskList'))}
        {tool('Code', Code, () => editor.chain().focus().toggleCodeBlock().run(), active('codeBlock'))}
        <TableButton editor={editor} on={active('table')} />
        {tool('Equation', Sigma, () => onInsertEquation?.())}
        {active('table') && <div className="w-full pt-1"><TableTools editor={editor} /></div>}
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
