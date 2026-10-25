'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BellPlus, Plus, Upload, CheckSquare, X, NotebookPen, Search, FolderInput, FolderPlus, FileText, FileType2, ExternalLink, SquareArrowOutUpRight, Trash2 } from 'lucide-react'
import { ViewOptions } from '@/components/ui/ViewOptions'
import { ItemList, ItemTile } from '@/components/ui/ItemTile'
import { StackTile } from '@/components/ui/StackTile'
import { sortNotes, useView } from '@/lib/ui/listView'
import { MoveToNotebookDialog, NotebookNameDialog } from '@/components/notes/NotebookDialogs'
import { NotebookCover } from '@/components/notes/NotebookCover'
import Link from 'next/link'
import { requestReminder } from '@/lib/reminders/events'
import { countByNotebook, filterNotes, notebookColor } from '@/lib/notes/notebooks'
import { createNotebook, listNotebooks, moveNotes } from '@/lib/data/notebooks'
import { EmptyState } from '@/components/ui/EmptyState'
import { PAGE_TITLE } from '@/components/ui/PageHeader'
import { useScanSaved } from '@/lib/scan/events'
import { formatDistanceToNow } from 'date-fns'
import { CourseTag } from '@/components/ui/CourseTag'
import { ExportMenu } from '@/components/notes/ExportMenu'
import { requestUpload } from '@/lib/scan/events'
import { useToast } from '@/components/providers/ToastProvider'
import { useConfirm } from '@/components/providers/ConfirmProvider'
import { ContextMenu, type MenuEntry } from '@/components/ui/ContextMenu'
import { exportNotesToWord, openPdfExport } from '@/lib/export/exportNotes'
import { supabase } from '@/lib/supabase/client'
import { createNote, deleteNote, listNotes, searchNotes } from '@/lib/data/notes'
import { listCourses } from '@/lib/data/courses'
import type { Course, NoteSummary, Notebook } from '@/lib/types'

// Fired by the editor after a save, so titles and order in the list stay current
export const NOTES_CHANGED = 'studyhub:notes-changed'

// The notes home: search, course filter, import, and selecting notes to export
export function NotesSidebar() {
  const router = useRouter()
  const toast = useToast()
  const [notes, setNotes] = useState<NoteSummary[] | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [q, setQ] = useState('')
  const [course, setCourse] = useState('')
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [naming, setNaming] = useState(false) // the New notebook dialog
  const [moving, setMoving] = useState<string[] | null>(null) // the notes being moved to a notebook
  const [version, setVersion] = useState(0)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  // Scan (in the app's sidebar) saved a note: refresh the list
  useScanSaved(() => setVersion(v => v + 1))
  const confirm = useConfirm()
  const [menu, setMenu] = useState<{ x: number; y: number; note: NoteSummary } | null>(null)
  const closeMenu = useCallback(() => setMenu(null), [])

  useEffect(() => { listCourses(supabase()).then(setCourses).catch(() => {}) }, [])
  useEffect(() => { listNotebooks(supabase()).then(setNotebooks).catch(() => {}) }, [])

  useEffect(() => {
    const bump = () => setVersion(v => v + 1)
    window.addEventListener(NOTES_CHANGED, bump)
    return () => window.removeEventListener(NOTES_CHANGED, bump)
  }, [])

  // Search titles and note text on the server; debounce typing
  useEffect(() => {
    const term = q.trim()
    let current = true // a newer search supersedes this one, even if this one answers later
    const t = setTimeout(() => {
      const load = term ? searchNotes(supabase(), term) : listNotes(supabase())
      load.then(n => { if (current) setNotes(n) }).catch(() => { if (current) toast('Couldn\'t load notes.') })
    }, term ? 250 : 0)
    return () => { current = false; clearTimeout(t) }
  }, [q, version, toast])

  async function create() {
    try {
      const n = await createNote(supabase(), { course_id: course || null })
      router.push(`/notes/${n.id}`)
    } catch { toast('Couldn\'t create a note.') }
  }

  // Quick actions for one note: right-click / long-press a tile, the menu key, or its ⋯ button
  function openMenu(e: React.MouseEvent, n: NoteSummary) {
    e.preventDefault()
    // From the keyboard (menu key, Shift+F10) or the ⋯ button there's no pointer spot: use the element's corner
    const fromPointer = e.type === 'contextmenu' && (e.clientX || e.clientY)
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setMenu({ x: fromPointer ? e.clientX : r.left, y: fromPointer ? e.clientY : r.bottom, note: n })
  }

  async function remove(n: NoteSummary) {
    const ok = await confirm({
      title: 'Delete this note?', body: `“${n.title || 'Untitled'}” will be deleted. This can't be undone.`,
      confirmLabel: 'Delete note', danger: true,
    })
    if (!ok) return
    try {
      await deleteNote(supabase(), n.id)
      setNotes(ns => ns?.filter(x => x.id !== n.id) ?? ns)
      setSelected(s => s.filter(x => x !== n.id))
      setVersion(v => v + 1)
    } catch { toast('Couldn\'t delete the note.') }
  }

  // A new notebook stays here as one more cover; it starts in the course the list is filtered to
  async function addNotebook(name: string, courseId: string | null) {
    setNaming(false)
    try { const b = await createNotebook(supabase(), name, courseId); setNotebooks(bs => [...bs, b]) } catch { toast("Couldn't make the notebook.") }
  }
  async function moveTo(ids: string[], target: string | null) {
    setMoving(null)
    try {
      await moveNotes(supabase(), ids, target)
      setNotes(ns => ns?.map(n => (ids.includes(n.id) ? { ...n, notebook_id: target } : n)) ?? ns)
      setSelecting(false); setSelected([])
    } catch { toast("Couldn't move the notes.") }
  }
  const making = useRef(false) // a second press while the notebook is being made must not make another
  async function createAndMove(name: string) {
    if (making.current) return
    making.current = true
    const ids = moving ?? []
    try {
      let made: Notebook
      try { made = await createNotebook(supabase(), name, null) } catch { setMoving(null); toast("Couldn't make the notebook."); return }
      setNotebooks(bs => [...bs, made]) // it exists now, whether or not the move works
      await moveTo(ids, made.id)
    } finally { making.current = false }
  }

  const menuItems = (n: NoteSummary): MenuEntry[] => [
    { label: 'Open', icon: ExternalLink, onSelect: () => router.push(`/notes/${n.id}`) },
    { label: 'Open in new tab', icon: SquareArrowOutUpRight, onSelect: () => window.open(`/notes/${n.id}`, '_blank', 'noopener') },
    'sep',
    { label: 'Export as Word', icon: FileText, onSelect: () => { exportNotesToWord([n.id]).catch(() => toast('Couldn\'t create the Word document.')) } },
    { label: 'Export as PDF', icon: FileType2, onSelect: () => openPdfExport([n.id]) },
    { label: 'Move to notebook…', icon: FolderInput, onSelect: () => setMoving([n.id]) },
    { label: 'Remind me to review…', icon: BellPlus, onSelect: () => requestReminder({ title: `Review ${n.title || 'Untitled'}`, href: `/notes/${n.id}`, link_label: n.title || 'Untitled' }) },
    'sep',
    { label: 'Select', icon: CheckSquare, onSelect: () => { setSelecting(true); setSelected(s => (s.includes(n.id) ? s : [...s, n.id])) } },
    { label: 'Delete', icon: Trash2, danger: true, onSelect: () => { void remove(n) } },
  ]

  const view = useView('notes')
  const counts = countByNotebook(notes ?? [])
  const shown = sortNotes(filterNotes(notes ?? [], { notebook: '', course }), view.sort, Object.fromEntries(courses.map(c => [c.id, c.name])))
  const colorOf = (b: Notebook) => notebookColor(b, notes ?? [], courses)
  const bookOf = (id: string | null | undefined) => notebooks.find(b => b.id === id)
  const courseOf = (id: string | null) => courses.find(c => c.id === id)
  const empty = notes?.length === 0 && !q.trim()
  const toggle = (id: string) => setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]))

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className={PAGE_TITLE}>Notes</h1>
        <div className="flex flex-wrap items-center gap-2">
          {selecting ? (
            <>
              <span className="text-sm text-muted">{selected.length} selected</span>
              <button className="btn" disabled={!selected.length} aria-label="Move to notebook" onClick={() => setMoving(selected)}><FolderInput size={14} aria-hidden />Move</button>
              <ExportMenu ids={selected} label="Export selected" disabled={!selected.length} />
              <button className="btn-ghost" onClick={() => { setSelecting(false); setSelected([]) }} aria-label="Stop selecting"><X size={15} aria-hidden />Done</button>
            </>
          ) : (
            <>
              {/* on a phone, Upload is in the Create button */}
              <button className="btn max-sm:hidden" onClick={requestUpload}><Upload size={14} aria-hidden />Upload</button>
              {!empty && <button className="btn" onClick={() => setSelecting(true)}><CheckSquare size={14} aria-hidden />Select</button>}
              {/* on a phone, Select then Export selected does this */}
              {!empty && <span className="max-sm:hidden"><ExportMenu label="Export all" fileName="Studyhub notes" /></span>}
              <button className="btn-primary" onClick={create}><Plus size={14} aria-hidden />Note</button>
            </>
          )}
        </div>
      </div>

      <div className="mb-3">
        <NotebookShelf books={notebooks.map(b => ({ id: b.id, name: b.name, count: counts.byId[b.id] ?? 0, color: colorOf(b) }))} onNew={() => setNaming(true)} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-48 flex-1 max-sm:basis-full">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input className="input w-full pl-9" placeholder="Search notes" value={q} onChange={e => setQ(e.target.value)} aria-label="Search notes" />
        </div>
        {/* on a phone, one row that scrolls sideways rather than two stacked rows */}
        <div data-filter-row className="no-scrollbar -mx-5 flex min-w-0 gap-2 overflow-x-auto px-5 sm:mx-0 sm:overflow-visible sm:px-0 [&>*]:shrink-0">
        <select className="input" value={course} onChange={e => setCourse(e.target.value)} aria-label="Filter by course">
          <option value="">All courses</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <ViewOptions page="notes" />
        </div>
      </div>

      {empty && (
        <EmptyState icon={NotebookPen} tone="b" title="Your notes start here" body="Write lecture notes, summaries and formulas, or upload slides, a Word document, a PDF or a text file.">
          <button className="btn" onClick={requestUpload}><Upload size={14} aria-hidden />Upload</button>
          <button className="btn-primary" onClick={create}>Write your first note</button>
        </EmptyState>
      )}
      {notes && !empty && shown.length === 0 && (
        <p className="py-2 text-sm text-muted">No notes match.</p>
      )}

      <ItemList label="Notes" layout={view.layout}>
        {shown.map(n => {
          const c = courseOf(n.course_id)
          const book = bookOf(n.notebook_id)
          const select = selecting ? { on: selected.includes(n.id), onToggle: () => toggle(n.id) } : undefined
          if (view.layout === 'grid') return (
            <StackTile key={n.id} motif="sheets" color={c?.color} title={n.title} href={`/notes/${n.id}`} tag={c && <CourseTag course={c} />}
              big={new Date(n.updated_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} bigLabel="last edited"
              side={book && <span className="inline-flex max-w-full items-center gap-1"><span aria-hidden className="h-3 w-2.5 shrink-0 rounded-l-[2px] rounded-r-[3px]" style={{ background: colorOf(book) }} /><span className="truncate">{book.name}</span></span>}
              select={select} onMenu={e => openMenu(e, n)} onContextMenu={e => openMenu(e, n)} />
          )
          return (
            <ItemTile key={n.id} layout={view.layout} icon={FileText} color={c?.color} title={n.title} href={`/notes/${n.id}`}
              subtitle={book && <span className="inline-flex min-w-0 items-center gap-1"><span aria-hidden className="h-3 w-2.5 shrink-0 rounded-l-[2px] rounded-r-[3px]" style={{ background: colorOf(book) }} /><span className="truncate">{book.name}</span></span>}
              meta={c && <CourseTag course={c} />} aside={formatDistanceToNow(new Date(n.updated_at), { addSuffix: true })}
              select={select}
              onMenu={e => openMenu(e, n)} onContextMenu={e => openMenu(e, n)} />
          )
        })}
      </ItemList>

      <NotebookNameDialog open={naming} onClose={() => setNaming(false)} title="New notebook" submitLabel="Create"
        courses={courses} initialCourse={course || null} onSubmit={(name, cid) => { void addNotebook(name, cid) }} />
      <MoveToNotebookDialog open={moving !== null} onClose={() => setMoving(null)} notebooks={notebooks} onMove={id => { void moveTo(moving ?? [], id) }} onCreateAndMove={name => { void createAndMove(name) }} />
      {menu && <ContextMenu x={menu.x} y={menu.y} label={menu.note.title || 'Untitled'} items={menuItems(menu.note)} onClose={closeMenu} />}
    </div>
  )
}

// The notebooks as a row of covers, each opening its own page, and a blank one to start a new notebook
function NotebookShelf({ books, onNew }: { books: { id: string; name: string; count: number; color: string }[]; onNew: () => void }) {
  return (
    <div className="-mx-1.5 flex w-[calc(100%+0.75rem)] gap-3 overflow-x-auto p-1.5">
      {books.length > 0 && (
        <ul aria-label="Notebooks" className="flex gap-3">
          {books.map(b => (
            <li key={b.id} className="w-28 shrink-0">
              <Link href={`/notebooks/${b.id}`} aria-label={`Open ${b.name}, ${b.count} note${b.count === 1 ? '' : 's'}`}
                className="block rounded-xl outline-none transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-accent">
                <NotebookCover name={b.name} count={b.count} color={b.color} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <button type="button" aria-label="New notebook" onClick={onNew}
        className="flex aspect-[4/5] w-28 shrink-0 flex-col items-center justify-center gap-1.5 rounded-l-md rounded-r-xl border-2 border-dashed border-line text-xs font-medium text-muted transition hover:border-accent hover:text-accent">
        <FolderPlus size={18} aria-hidden />New notebook
      </button>
    </div>
  )
}
