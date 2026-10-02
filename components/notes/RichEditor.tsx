'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import { Bold, Italic, Heading2, List, ListChecks, Code, Sigma, Table } from 'lucide-react'
import { noteExtensions, type EditMath } from './extensions'
import { FindHighlight } from './findInNote'
import { TableTools } from './TableTools'
import { TableGridPicker } from './TableGridPicker'
import { editorQuickActions } from './editorQuickActions'
import { ContextMenu, type MenuEntry } from '@/components/ui/ContextMenu'
import { useToast } from '@/components/providers/ToastProvider'

export const insertTable = (editor: Editor, rows: number, cols: number) =>
  editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run()

// Toolbar Table button: opens the size grid in a small popover. Drawn on the page (portal, fixed
// position) because the toolbar scrolls sideways on small screens and would clip it.
function TableButton({ editor, on }: { editor: Editor; on: boolean }) {
  const [at, setAt] = useState<{ left: number; top: number } | null>(null)
  const panel = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!at) return
    const close = (e: Event) => {
      if (!panel.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) setAt(null)
    }
    const away = () => setAt(null)
    document.addEventListener('mousedown', close)
    window.addEventListener('resize', away)
    return () => { document.removeEventListener('mousedown', close); window.removeEventListener('resize', away) }
  }, [at])
  function toggle() {
    if (at) { setAt(null); return }
    const r = button.current!.getBoundingClientRect()
    const width = 232 // the grid's width; keep it on screen
    setAt({ left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)), top: r.bottom + 6 })
  }
  return (
    <>
      <button ref={button} type="button" aria-label="Table" title="Table" aria-haspopup="dialog" aria-expanded={!!at}
        onClick={toggle}
        className={`shrink-0 rounded p-1.5 ${on || at ? 'bg-surface text-fg' : 'text-muted hover:text-fg'}`}><Table size={16} aria-hidden /></button>
      {at && createPortal(
        <div ref={panel} role="dialog" aria-label="Insert table" className="menu-panel fixed mt-0" style={at}>
          <TableGridPicker autoFocus onPick={(r, c) => { setAt(null); insertTable(editor, r, c) }}
            onCancel={() => { setAt(null); button.current?.focus() }} />
        </div>,
        document.body,
      )}
    </>
  )
}

export function RichEditor({ markdown, onChange, onReady, onEditMath, onInsertEquation, autoMath = true }: {
  markdown: string
  onChange: (md: string) => void
  /** Hands the editor to the page (menu bar commands, find); null when it goes away. */
  onReady?: (editor: Editor | null) => void
  /** Clicking an equation opens it for editing. Must only call stable setters: it is read once. */
  onEditMath?: EditMath
  onInsertEquation?: () => void
  /** Settings > Turn typed maths into equations */
  autoMath?: boolean
}) {
  const toast = useToast()
  // Built once: a new array each render would make Tiptap reconfigure the editor every time
  const [extensions] = useState(() => [...noteExtensions({ onEditMath }), FindHighlight])
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuEntry[] } | null>(null)
  const closeMenu = useCallback(() => setMenu(null), [])
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

  // The auto-maths rule checks this on each keystroke, so flipping the setting applies straight away
  useEffect(() => {
    editor?.commands.setAutoMath(autoMath)
  }, [editor, autoMath])

  useEffect(() => {
    if (!editor) return
    onReady?.(editor)
    return () => onReady?.(null)
  }, [editor, onReady])

  if (!editor) return null
  const active = (name: string) => editor.isActive(name)

  // Right-click (long-press on touch) opens quick actions for the spot clicked.
  // Shift + right-click still gives the browser's own menu (spelling suggestions).
  function openQuickActions(e: React.MouseEvent) {
    if (e.shiftKey || !editor) return
    e.preventDefault()
    const view = editor.view
    const hit = view.posAtCoords({ left: e.clientX, top: e.clientY })
    const onMath = (e.target as HTMLElement).closest('[data-type="inline-math"], [data-type="block-math"]')
    const { from, to } = editor.state.selection
    // Act where the student clicked, unless they right-clicked inside their selection
    if (hit && !onMath && (hit.pos < from || hit.pos > to || from === to)) editor.commands.setTextSelection(hit.pos)
    // Find the equation node drawn by the element that was clicked
    let mathPos: number | null = null
    if (onMath) {
      editor.state.doc.descendants((node, pos) => {
        if (mathPos !== null) return false
        if (node.type.name !== 'inlineMath' && node.type.name !== 'blockMath') return
        if (view.nodeDOM(pos)?.contains(e.target as Node)) mathPos = pos
      })
    }
    const items = editorQuickActions(editor, { mathPos }, {
      onInsertEquation: () => onInsertEquation?.(),
      onEditMath: (kind, latex, pos) => onEditMath?.(kind, latex, pos),
      onPasteFailed: () => toast(`Your browser blocked pasting from this menu. Use ${/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+'}V instead.`),
    })
    setMenu({ x: e.clientX, y: e.clientY, items })
  }

  const tool = (label: string, Icon: typeof Bold, run: () => void, on = false) => (
    <button type="button" aria-label={label} title={label} onClick={run} aria-pressed={on}
      className={`shrink-0 rounded p-1.5 ${on ? 'bg-surface text-fg' : 'text-muted hover:text-fg'}`}><Icon size={16} aria-hidden /></button>
  )

  return (
    <div>
      <div className="sticky top-[57px] z-20 -mx-2 flex flex-nowrap items-center gap-0.5 overflow-x-auto border-b border-line bg-bg/95 px-2 pb-1.5 pt-1 backdrop-blur [scrollbar-width:none]">
        {tool('Bold', Bold, () => editor.chain().focus().toggleBold().run(), active('bold'))}
        {tool('Italic', Italic, () => editor.chain().focus().toggleItalic().run(), active('italic'))}
        {tool('Heading', Heading2, () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active('heading'))}
        {tool('Bulleted list', List, () => editor.chain().focus().toggleBulletList().run(), active('bulletList'))}
        {tool('Checklist', ListChecks, () => editor.chain().focus().toggleTaskList().run(), active('taskList'))}
        {tool('Code', Code, () => editor.chain().focus().toggleCodeBlock().run(), active('codeBlock'))}
        <TableButton editor={editor} on={active('table')} />
        {tool('Equation', Sigma, () => onInsertEquation?.())}
        {active('table') && <><span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-line" /><TableTools editor={editor} /></>}
      </div>
      <EditorContent editor={editor} onContextMenu={openQuickActions} />
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} label="Quick actions" onClose={closeMenu}
        footer="Shift + right-click for the browser menu" />}
    </div>
  )
}
