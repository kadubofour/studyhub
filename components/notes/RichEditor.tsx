'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import { Bold, Italic, Heading2, ImagePlus, List, ListChecks, Code, PencilRuler, Sigma, Table } from 'lucide-react'
import { noteExtensions, type EditMath } from './extensions'
import { FindHighlight } from './findInNote'
import { TableTools } from './TableTools'
import { TableGridPicker } from './TableGridPicker'
import { editorQuickActions } from './editorQuickActions'
import { ContextMenu, type MenuEntry } from '@/components/ui/ContextMenu'
import { useToast } from '@/components/providers/ToastProvider'
import { useProfile } from '@/components/providers/ProfileProvider'
import { NoteImagesContext, type NoteImageInfo } from './NoteImagesContext'
import { insertNoteImage } from './noteImage'
import { supabase } from '@/lib/supabase/client'
import { makeImageResolver } from '@/lib/notes/images'
import { ACCEPTED, IMAGE_ERROR_TEXT, ImageError, prepareImage, uploadNoteImage } from '@/lib/notes/prepareImage'

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

// Toolbar Image button: opens the file picker
function PictureButton({ input }: { input: React.RefObject<HTMLInputElement | null> }) {
  return <button type="button" aria-label="Image" title="Image" onClick={() => input.current?.click()} className="shrink-0 rounded p-1.5 text-muted hover:text-fg"><ImagePlus size={16} aria-hidden /></button>
}

const isPicture = (f: File) => ACCEPTED.includes(f.type)
function onlyPicture(data: DataTransfer | null): boolean {
  const html = (data?.getData('text/html') ?? '').replace(/<!--[\s\S]*?-->|<meta[^>]*>/gi, '').trim()
  const text = (data?.getData('text/plain') ?? '').trim()
  return (!html || /^<img[^>]*>$/i.test(html)) && !text
}
// The description a picture gets from its file name: "Krebs cycle.png" -> "Krebs cycle"; a screenshot's "image.png" gets none
const altFrom = (name: string) => { const n = name.replace(/\.[^.]+$/, '').trim(); return /^(image|screenshot|untitled)\d*$/i.test(n) ? '' : n.slice(0, 120) }

export function RichEditor({ markdown, onChange, onReady, onEditMath, onInsertEquation, onMarkup, onDraw, autoMath = true }: {
  markdown: string
  onChange: (md: string) => void
  /** Hands the editor to the page (menu bar commands, find); null when it goes away. */
  onReady?: (editor: Editor | null) => void
  /** Clicking an equation opens it for editing. Must only call stable setters: it is read once. */
  onEditMath?: EditMath
  onInsertEquation?: () => void
  /** Markup was chosen on a picture in the note */
  onMarkup?: (img: NoteImageInfo) => void
  /** The Draw button: a sketch from a blank page */
  onDraw?: () => void
  /** Profile > Preferences > Turn typed maths into equations */
  autoMath?: boolean
}) {
  const toast = useToast()
  const { profile } = useProfile()
  const resolver = useMemo(() => makeImageResolver(supabase(), profile.id), [profile.id])
  const imagesCtx = useMemo(() => ({ resolve: resolver, onMarkup }), [resolver, onMarkup])
  const pictureInput = useRef<HTMLInputElement>(null)
  const editorRef = useRef<Editor | null>(null)
  const addRef = useRef<(files: File[]) => void>(() => {})
  // Built once: a new array each render would make Tiptap reconfigure the editor every time
  const [extensions] = useState(() => [...noteExtensions({ onEditMath, imageView: true }), FindHighlight])
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuEntry[] } | null>(null)
  const closeMenu = useCallback(() => setMenu(null), [])
  const editor = useEditor({
    extensions,
    content: markdown,
    contentType: 'markdown',
    immediatelyRender: false,
    // Re-render on every change so the toolbar's on/off states and table controls follow the cursor
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: { class: 'prose-note min-h-[50vh] outline-none py-3', 'aria-label': 'Note' },
      // A picture pasted (a screenshot) or dropped on the note goes in; anything else is left to the editor
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter(isPicture)
        // Office puts a picture of the copied text or table beside the text itself: only a paste that is just a picture goes in as one
        if (!files.length || !onlyPicture(event.clipboardData)) return false
        event.preventDefault(); addRef.current(files); return true
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false
        const files = Array.from(event.dataTransfer?.files ?? []).filter(isPicture)
        if (!files.length) return false
        event.preventDefault()
        let at: { pos: number } | null = null
        try { at = view.posAtCoords({ left: event.clientX, top: event.clientY }) } catch { /* no layout to ask: keep the cursor where it is */ }
        if (at) editorRef.current?.commands.setTextSelection(at.pos)
        addRef.current(files); return true
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getMarkdown()),
  })

  // The auto-maths rule checks this on each keystroke, so flipping the setting applies straight away
  useEffect(() => {
    editor?.commands.setAutoMath(autoMath)
  }, [editor, autoMath])

  // Pictures go in one after another: shrunk, stored in the student's folder, then written into the note. A reason is given when one cannot.
  useEffect(() => {
    editorRef.current = editor
    addRef.current = files => {
      void (async () => {
        for (const file of files) {
          try {
            const blob = await prepareImage(file)
            const token = await uploadNoteImage(supabase(), profile.id, blob)
            if (editorRef.current) insertNoteImage(editorRef.current, token, altFrom(file.name))
          } catch (e) { toast(e instanceof ImageError ? IMAGE_ERROR_TEXT[e.code] : 'Couldn\'t add that picture.') }
        }
      })()
    }
  }, [editor, profile.id, toast])

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
        <PictureButton input={pictureInput} />
        {tool('Draw', PencilRuler, () => onDraw?.())}
        {active('table') && <><span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-line" /><TableTools editor={editor} /></>}
      </div>
      <input ref={pictureInput} type="file" hidden aria-label="Choose pictures" accept={ACCEPTED.join(',')} multiple
        onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ''; if (files.length) addRef.current(files) }} />
      <NoteImagesContext.Provider value={imagesCtx}>
        <EditorContent editor={editor} onContextMenu={openQuickActions} />
      </NoteImagesContext.Provider>
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} label="Quick actions" onClose={closeMenu}
        footer="Shift + right-click for the browser menu" />}
    </div>
  )
}
