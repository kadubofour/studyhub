'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Upload, CheckSquare, X, NotebookPen, Search, MoreHorizontal, FileText, FileType2, ExternalLink, SquareArrowOutUpRight, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { CourseTag } from '@/components/ui/CourseTag'
import { ExportMenu } from '@/components/notes/ExportMenu'
import { ImportDialog } from '@/components/notes/ImportDialog'
import { useToast } from '@/components/providers/ToastProvider'
import { useConfirm } from '@/components/providers/ConfirmProvider'
import { ContextMenu, type MenuEntry } from '@/components/ui/ContextMenu'
import { exportNotesToWord, openPdfExport } from '@/lib/export/exportNotes'
import { supabase } from '@/lib/supabase/client'
import { createNote, deleteNote, listNotes, searchNotes } from '@/lib/data/notes'
import { listCourses } from '@/lib/data/courses'
import type { Course, NoteSummary } from '@/lib/types'

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
  const [version, setVersion] = useState(0)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const confirm = useConfirm()
  const [menu, setMenu] = useState<{ x: number; y: number; note: NoteSummary } | null>(null)
  const closeMenu = useCallback(() => setMenu(null), [])

  useEffect(() => { listCourses(supabase()).then(setCourses).catch(() => {}) }, [])

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

  const menuItems = (n: NoteSummary): MenuEntry[] => [
    { label: 'Open', icon: ExternalLink, onSelect: () => router.push(`/notes/${n.id}`) },
    { label: 'Open in new tab', icon: SquareArrowOutUpRight, onSelect: () => window.open(`/notes/${n.id}`, '_blank', 'noopener') },
    'sep',
    { label: 'Export as Word', icon: FileText, onSelect: () => { exportNotesToWord([n.id]).catch(() => toast('Couldn\'t create the Word document.')) } },
    { label: 'Export as PDF', icon: FileType2, onSelect: () => openPdfExport([n.id]) },
    'sep',
    { label: 'Select', icon: CheckSquare, onSelect: () => { setSelecting(true); setSelected(s => (s.includes(n.id) ? s : [...s, n.id])) } },
    { label: 'Delete', icon: Trash2, danger: true, onSelect: () => { void remove(n) } },
  ]

  const shown = (notes ?? []).filter(n => !course || n.course_id === course)
  const courseOf = (id: string | null) => courses.find(c => c.id === id)
  const empty = notes?.length === 0 && !q.trim()
  const toggle = (id: string) => setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]))

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Notes</h1>
        <div className="flex flex-wrap items-center gap-2">
          {selecting ? (
            <>
              <span className="text-sm text-muted">{selected.length} selected</span>
              <ExportMenu ids={selected} label="Export selected" disabled={!selected.length} />
              <button className="btn-ghost" onClick={() => { setSelecting(false); setSelected([]) }} aria-label="Stop selecting"><X size={15} aria-hidden />Done</button>
            </>
          ) : (
            <>
              <button className="btn" onClick={() => setImporting(true)}><Upload size={14} aria-hidden />Import</button>
              {!empty && <button className="btn" onClick={() => setSelecting(true)}><CheckSquare size={14} aria-hidden />Select</button>}
              {!empty && <ExportMenu label="Export all" fileName="Studyhub notes" />}
              <button className="btn-primary" onClick={create}><Plus size={14} aria-hidden />Note</button>
            </>
          )}
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input className="input w-full pl-9" placeholder="Search notes" value={q} onChange={e => setQ(e.target.value)} aria-label="Search notes" />
        </div>
        <select className="input" value={course} onChange={e => setCourse(e.target.value)} aria-label="Filter by course">
          <option value="">All courses</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {empty && (
        <div className="card flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent"><NotebookPen size={22} aria-hidden /></span>
          <p className="max-w-sm text-sm text-muted">Write lecture notes, summaries and formulas, or import a Word document or PDF.</p>
          <div className="flex gap-2">
            <button className="btn" onClick={() => setImporting(true)}><Upload size={14} aria-hidden />Import</button>
            <button className="btn-primary" onClick={create}>Write your first note</button>
          </div>
        </div>
      )}
      {notes && !empty && shown.length === 0 && <p className="py-2 text-sm text-muted">No notes match.</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map(n => {
          const c = courseOf(n.course_id)
          const on = selected.includes(n.id)
          const body = (
            <>
              <div className="flex items-start gap-2">
                {selecting && <input type="checkbox" checked={on} readOnly tabIndex={-1} aria-hidden className="mt-1 size-4 accent-[var(--accent-solid)]" />}
                <span className="line-clamp-2 flex-1 font-medium">{n.title || 'Untitled'}</span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <CourseTag course={c} />
                <span className="ml-auto text-xs text-muted">{formatDistanceToNow(new Date(n.updated_at), { addSuffix: true })}</span>
              </div>
            </>
          )
          const cls = `tile block border-t-4 text-left transition hover:-translate-y-0.5 ${on ? 'ring-2 ring-accent' : ''}`
          const style = { borderTopColor: c?.color ?? 'var(--line)' }
          return selecting ? (
            <button key={n.id} type="button" role="checkbox" aria-checked={on} aria-label={`Select ${n.title || 'Untitled'}`}
              className={cls} style={style} onClick={() => toggle(n.id)}>{body}</button>
          ) : (
            <div key={n.id} className="group relative">
              <Link href={`/notes/${n.id}`} className={`${cls} h-full pr-10`} style={style} onContextMenu={e => openMenu(e, n)}>{body}</Link>
              <button type="button" aria-label={`More actions for ${n.title || 'Untitled'}`} aria-haspopup="menu"
                className="absolute right-2 top-3 rounded-lg p-1 text-muted opacity-0 transition hover:bg-surface hover:text-fg focus-visible:opacity-100 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100"
                onClick={e => openMenu(e, n)}><MoreHorizontal size={16} aria-hidden /></button>
            </div>
          )
        })}
      </div>

      {menu && <ContextMenu x={menu.x} y={menu.y} label={menu.note.title || 'Untitled'} items={menuItems(menu.note)} onClose={closeMenu} />}
      <ImportDialog open={importing} onClose={() => setImporting(false)} courses={courses} onImported={() => setVersion(v => v + 1)} />
    </div>
  )
}
