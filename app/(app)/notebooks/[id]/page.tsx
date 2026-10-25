'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, FileText, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { NotebookCover } from '@/components/notes/NotebookCover'
import { NotebookNameDialog } from '@/components/notes/NotebookDialogs'
import { CourseTag } from '@/components/ui/CourseTag'
import { ItemList, ItemTile } from '@/components/ui/ItemTile'
import { StackTile } from '@/components/ui/StackTile'
import { ViewOptions } from '@/components/ui/ViewOptions'
import { useToast } from '@/components/providers/ToastProvider'
import { useConfirm } from '@/components/providers/ConfirmProvider'
import { supabase } from '@/lib/supabase/client'
import { deleteNotebook, listNotebooks, updateNotebook } from '@/lib/data/notebooks'
import { createNote, listNotes } from '@/lib/data/notes'
import { listCourses } from '@/lib/data/courses'
import { notebookColor, notebookCourse } from '@/lib/notes/notebooks'
import { sortNotes, useView } from '@/lib/ui/listView'
import type { Course, Notebook, NoteSummary } from '@/lib/types'
import { PAGE_TITLE } from '@/components/ui/PageHeader'
import { BackLink } from '@/components/ui/BackLink'

const plural = (n: number) => `${n} note${n === 1 ? '' : 's'}`

// A notebook opened: its cover, its name and course, and its notes (see docs/superpowers/specs/2026-10-31-notebook-pages-design.md)
export default function NotebookPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const view = useView('notes')
  const [book, setBook] = useState<Notebook | null | undefined>(undefined) // undefined while loading, null when not found
  const [notes, setNotes] = useState<NoteSummary[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [q, setQ] = useState('')
  const [renaming, setRenaming] = useState(false)

  useEffect(() => {
    let live = true
    const sb = supabase()
    Promise.all([listNotebooks(sb), listNotes(sb), listCourses(sb)])
      .then(([bs, ns, cs]) => { if (live) { setBook(bs.find(b => b.id === id) ?? null); setNotes(ns); setCourses(cs) } })
      .catch(() => { if (live) setBook(null) })
    return () => { live = false }
  }, [id])

  if (book === undefined) return <p className="text-sm text-muted">Loading…</p>
  if (book === null) return (
    <div className="py-10 text-center">
      <h1 className="font-display text-2xl font-semibold">Notebook not found</h1>
      <p className="mt-1 text-sm text-muted">It may have been deleted.</p>
      <Link href="/notes" className="btn mt-4">Go to Notes</Link>
    </div>
  )

  const inside = notes.filter(n => n.notebook_id === book.id)
  const courseId = notebookCourse(book, notes)
  const course = courses.find(c => c.id === courseId) ?? null
  const color = notebookColor(book, notes, courses)
  const courseOf = (cid: string | null) => courses.find(c => c.id === cid)
  const shown = sortNotes(inside.filter(n => !q.trim() || (n.title || 'Untitled').toLowerCase().includes(q.trim().toLowerCase())), view.sort, Object.fromEntries(courses.map(c => [c.id, c.name])))

  async function newNote() {
    try { const n = await createNote(supabase(), { notebook_id: book!.id, course_id: courseId }); router.push(`/notes/${n.id}`) } catch { toast("Couldn't create a note.") }
  }
  async function rename(name: string, cid: string | null) {
    setRenaming(false)
    const before = book!
    setBook({ ...before, name, course_id: cid })
    try { await updateNotebook(supabase(), before.id, { name, course_id: cid }) } catch { setBook(before); toast("Couldn't save the notebook.") }
  }
  async function remove() {
    if (!await confirm({ title: 'Delete this notebook?', body: `“${book!.name}” will be deleted. Its notes are kept; they become unfiled.`, confirmLabel: 'Delete', danger: true })) return
    try { await deleteNotebook(supabase(), book!.id); router.push('/notes') } catch { toast("Couldn't delete the notebook.") }
  }

  return (
    <div>
      <BackLink href="/notes">Notes</BackLink>
      <div className="mb-8 flex flex-wrap items-end gap-6">
        <div data-testid="notebook-cover" className="w-28 shrink-0 sm:w-32"><NotebookCover name={book.name} count={inside.length} color={color} /></div>
        <div className="min-w-0 flex-1">
          <h1 className={PAGE_TITLE}>{book.name}</h1>
          <p className="mt-1.5 text-[15px] text-muted">{plural(inside.length)}{course ? ` · ${course.name}` : ''}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={() => { void newNote() }}><Plus size={15} aria-hidden />New note</button>
            <button type="button" className="btn" onClick={() => setRenaming(true)}><Pencil size={14} aria-hidden />Rename</button>
            <button type="button" className="btn-ghost hover:!text-danger" onClick={() => { void remove() }}><Trash2 size={14} aria-hidden />Delete notebook</button>
          </div>
        </div>
      </div>

      {inside.length === 0 ? (
        <div className="rounded-2xl bg-surface px-4 py-10 text-center text-sm text-muted">
          No notes in this notebook yet.
          <div className="mt-3"><button type="button" className="btn" onClick={() => { void newNote() }}><Plus size={14} aria-hidden />New note</button></div>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <div className="relative min-w-48 flex-1">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
              <input className="input w-full pl-9" placeholder={`Search ${book.name}`} value={q} onChange={e => setQ(e.target.value)} aria-label="Search this notebook" />
            </div>
            <ViewOptions page="notes" />
          </div>
          {shown.length === 0 && <p className="py-2 text-sm text-muted">No notes match.</p>}
          <ItemList label={`Notes in ${book.name}`} layout={view.layout}>
            {shown.map(n => {
              const c = courseOf(n.course_id)
              if (view.layout === 'grid') return (
                <StackTile key={n.id} motif="sheets" color={c?.color} title={n.title || 'Untitled'} href={`/notes/${n.id}`} tag={c && <CourseTag course={c} />}
                  big={new Date(n.updated_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} bigLabel="last edited" />
              )
              return (
                <ItemTile key={n.id} layout={view.layout} icon={FileText} color={c?.color} title={n.title} href={`/notes/${n.id}`}
                  meta={c && <CourseTag course={c} />} aside={formatDistanceToNow(new Date(n.updated_at), { addSuffix: true })} />
              )
            })}
          </ItemList>
        </>
      )}

      <NotebookNameDialog open={renaming} onClose={() => setRenaming(false)} title="Rename notebook" submitLabel="Save" initial={book.name}
        courses={courses} initialCourse={book.course_id ?? null} onSubmit={(name, cid) => { void rename(name, cid) }} />
    </div>
  )
}
