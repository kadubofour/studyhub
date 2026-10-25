'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { FileText, FolderInput, FolderOpen, FolderPlus, Layers, ListChecks, MessagesSquare, Mic, Search, Upload, type LucideIcon } from 'lucide-react'
import { CourseBar } from '@/components/planner/CourseBar'
import { CourseTag } from '@/components/ui/CourseTag'
import { ChoiceChips } from '@/components/ui/ChoiceChips'
import { EmptyState } from '@/components/ui/EmptyState'
import { ItemList, ItemTile } from '@/components/ui/ItemTile'
import { ViewOptions } from '@/components/ui/ViewOptions'
import { PageHeader } from '@/components/ui/PageHeader'
import { MoveToNotebookDialog, NotebookNameDialog } from '@/components/notes/NotebookDialogs'
import { NotebookCover } from '@/components/notes/NotebookCover'
import { notebookColor } from '@/lib/notes/notebooks'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { listCourses } from '@/lib/data/courses'
import { loadLibrary, moveItems } from '@/lib/data/library'
import { createNotebook, listNotebooks, moveNotes } from '@/lib/data/notebooks'
import { requestUpload } from '@/lib/scan/events'
import { requestQuiz } from '@/lib/quiz/events'
import { useView } from '@/lib/ui/listView'
import { countsByKind, folders, isMovable, visible, withKnownNotebooks, type Kind, type LibraryItem, type View } from '@/lib/library/items'
import type { Course, Notebook } from '@/lib/types'

// Each kind has its own section, in this order, named with its heading
const KIND: Record<Kind, { heading: string; icon: LucideIcon }> = {
  note: { heading: 'Notes', icon: FileText },
  deck: { heading: 'Decks', icon: Layers },
  lecture: { heading: 'Lectures', icon: Mic },
  quiz: { heading: 'Quizzes', icon: ListChecks },
  chat: { heading: 'Tutor chats', icon: MessagesSquare },
}
const KINDS = Object.keys(KIND) as Kind[]
const key = (i: { kind: Kind; id: string }) => `${i.kind}:${i.id}`
const day = (iso: string) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '')
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

// Everything the student has made in one place. A note in a notebook lives inside it, and a notebook opens on its own page.
// Filter by course and kind, search (which looks inside every notebook), and move things between courses and notebooks.
export default function LibraryPage() {
  const toast = useToast()
  const { layout } = useView('library')
  const address = useSearchParams()
  const fromAddress = address.get('course')
  const [courses, setCourses] = useState<Course[]>([])
  const [coursesLoaded, setCoursesLoaded] = useState(false)
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [items, setItems] = useState<LibraryItem[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [view, setView] = useState<View>(() => ({ course: fromAddress ?? 'all', kind: null, q: '', sort: 'recent' }))
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [target, setTarget] = useState('')
  const [moving, setMoving] = useState(false)
  const [dialog, setDialog] = useState<null | 'new' | 'file'>(null)

  // The items and the notebooks are read together, so a note never shows (or hides) against an out-of-date list of folders
  const read = () => Promise.all([loadLibrary(supabase(), new Date()), listNotebooks(supabase())])
  const load = useCallback(async () => {
    try { const [l, b] = await read(); setItems(l); setNotebooks(b); setFailed(false) } catch { setFailed(true); setItems(null) }
  }, [])
  useEffect(() => {
    let live = true
    listCourses(supabase()).then(c => { if (live) { setCourses(c); setCoursesLoaded(true) } }).catch(() => {})
    read().then(([l, b]) => { if (live) { setItems(l); setNotebooks(b); setFailed(false) } }).catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [])

  const courseOf = (id: string | null) => courses.find(c => c.id === id) ?? null
  const bookOf = (id: string | null | undefined) => notebooks.find(b => b.id === id) ?? null
  // An address naming a course that is gone (or never was) shows everything instead of an empty list
  const course = view.course === 'all' || view.course === 'none' || !coursesLoaded || courses.some(c => c.id === view.course) ? view.course : 'all'
  const current: View = { ...view, course }
  const known = items ? withKnownNotebooks(items, notebooks) : null
  // grouped by kind in the sections' order (each group keeps the chosen sort), so ticking and the screen agree on the order
  const shown = known ? (list => KINDS.flatMap(k => list.filter(i => i.kind === k)))(visible(known, current)) : []
  const shelf = known ? folders(known, notebooks, current) : []
  const counts = known ? countsByKind(known, current) : null
  // Only what is shown can be moved, so a tick hidden by a filter never goes along unseen
  const movableShown = shown.filter(isMovable)
  const picked = movableShown.filter(i => selected.has(key(i)))
  const pickedNotes = picked.length > 0 && picked.every(i => i.kind === 'note')
  const allShownPicked = movableShown.length > 0 && movableShown.every(i => selected.has(key(i)))
  const filtered = view.kind !== null || view.q.trim() !== '' || course !== 'all'
  const courseName = course !== 'all' && course !== 'none' ? courseOf(course)?.name : null

  function toggle(i: LibraryItem) {
    setSelected(s => { const n = new Set(s); if (n.has(key(i))) n.delete(key(i)); else n.add(key(i)); return n })
  }
  function toggleAll() {
    setSelected(s => { const n = new Set(s); for (const i of movableShown) { if (allShownPicked) n.delete(key(i)); else n.add(key(i)) } return n })
  }
  // The course is kept in the address (without a new history entry), so coming back from a note finds it again
  function remember(name: 'course', value: string | null) {
    const params = new URLSearchParams(window.location.search)
    if (value) params.set(name, value); else params.delete(name)
    const qs = params.toString()
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`)
  }
  function chooseCourse(id: string) {
    setView(v => ({ ...v, course: id }))
    remember('course', id === 'all' ? null : id)
  }

  async function move() {
    if (!picked.length || !target || moving) return
    setMoving(true)
    const wanted = picked.length
    try {
      const n = await moveItems(supabase(), picked.map(i => ({ kind: i.kind, id: i.id })), target === 'none' ? null : target)
      toast(n === wanted ? `Moved ${plural(n, 'item')}.` : n === 0 ? 'Nothing was moved. Those items had changed.' : `Moved ${n} of ${plural(wanted, 'item')}. The others had changed.`)
      setSelected(new Set()); setTarget('')
    } catch { toast('Could not move those items.') }
    await load()
    setMoving(false)
  }

  // Ticked notes into a notebook (or out of any, with null)
  async function file(book: Notebook | null) {
    setDialog(null)
    const ids = picked.map(i => i.id)
    try {
      await moveNotes(supabase(), ids, book?.id ?? null)
      toast(book ? `Moved ${plural(ids.length, 'note')} to ${book.name}.` : `Took ${plural(ids.length, 'note')} out of their notebook.`)
      setSelected(new Set())
    } catch { toast('Could not move those notes.') }
    await load()
  }
  async function fileInNew(name: string) {
    try {
      const book = await createNotebook(supabase(), name, null)
      setNotebooks(b => [...b, book])
      await file(book)
    } catch { setDialog(null); toast('Could not make that notebook.') }
  }
  // a new notebook starts in the course the Library is showing
  async function create(name: string, courseId: string | null) {
    setDialog(null)
    try { const book = await createNotebook(supabase(), name, courseId); setNotebooks(b => [...b, book]) } catch { toast('Could not make that notebook.') }
  }
  if (failed) return (
    <div>
      <PageHeader title="Library" />
      <p role="alert" className="text-sm text-danger">Could not load your library. Check your connection.</p>
      <button type="button" className="btn mt-2" onClick={() => { void load() }}>Try again</button>
    </div>
  )
  if (!items) return <div><PageHeader title="Library" /><p className="text-sm text-muted">Loading…</p></div>

  const empty = items.length === 0 && notebooks.length === 0
  return (
    <div>
      <PageHeader title="Library" actions={!empty && (
        <>
          {courseName && <Link href={`/courses/${course}`} className="btn-ghost text-accent">Open course page</Link>}
          <button type="button" className="btn" onClick={() => setDialog('new')}><FolderPlus size={14} aria-hidden />New notebook</button>
          {/* notes, decks and uploads are made from the Create button; a quiz is started here on a phone */}
          <button type="button" className="btn md:hidden" onClick={requestQuiz}><ListChecks size={14} aria-hidden />Quiz</button>
        </>
      )} />
      {empty ? (
        <EmptyState icon={FolderOpen} tone="b" title="Your library starts here" body="Every note, deck, lecture, quiz and tutor chat you make shows up here, sorted by course. Bring your first material in.">
          <button type="button" className="btn-primary" onClick={requestUpload}><Upload size={14} aria-hidden />Upload</button>
          <Link href="/notes" className="btn">Write a note</Link>
        </EmptyState>
      ) : (
        <>
          <div role="group" aria-label="Courses">
            <CourseBar courses={courses} selected={courses.some(c => c.id === course) ? course : null}
              onSelect={id => chooseCourse(id ?? 'all')} onChange={c => { setCourses(c); void load() }} // a deleted course frees its items, so read them again
              unsorted={{ active: course === 'none', onClick: () => chooseCourse('none') }} />
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-48 flex-1 max-sm:basis-full">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
              <input className="input w-full pl-9" placeholder="Search the library" aria-label="Search the library" value={view.q} onChange={e => setView(v => ({ ...v, q: e.target.value }))} />
            </div>
            <div data-filter-row className="no-scrollbar flex items-center gap-2 overflow-x-auto max-sm:w-full max-sm:justify-between [&>*]:shrink-0">
            <ChoiceChips className="flex-nowrap" label="Sort" value={view.sort} options={[{ value: 'recent', label: 'Newest first' }, { value: 'name', label: 'Name' }]} onChange={v => setView(prev => ({ ...prev, sort: v as View['sort'] }))} />
            <ViewOptions page="library" sort={false} />
            </div>
          </div>
          {(
            <div role="group" aria-label="Kinds" className="no-scrollbar -mx-5 mb-5 flex gap-1.5 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&>*]:shrink-0">
              {KINDS.map(k => (
                <button key={k} type="button" aria-pressed={view.kind === k} onClick={() => setView(v => ({ ...v, kind: v.kind === k ? null : k }))}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm pointer-coarse:py-2 transition ${view.kind === k ? 'border-transparent bg-accent-soft font-medium text-accent' : 'border-line bg-raised hover:bg-surface'}`}>
                  {KIND[k].heading} <span className="text-muted">{counts![k]}</span>
                </button>
              ))}
            </div>
          )}

          {shelf.length > 0 && (
            <section aria-labelledby="lib-notebooks" className="mb-7">
              <h2 id="lib-notebooks" className="section-label">Notebooks</h2>
              <ul aria-label="Notebooks" className="flex flex-wrap gap-4">
                {shelf.map(({ notebook, count }) => (
                  <li key={notebook.id} className="w-32">
                    <Link href={`/notebooks/${notebook.id}`} aria-label={`Open ${notebook.name}, ${plural(count, 'note')}`}
                      className="block w-full rounded-xl outline-none transition hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-accent">
                      <NotebookCover name={notebook.name} count={count} color={notebookColor(notebook, known ?? [], courses)} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="mb-2 flex min-h-9 flex-wrap items-center justify-between gap-2 text-sm">
            <label className="flex items-center gap-2 text-muted">
              <input type="checkbox" checked={allShownPicked} disabled={movableShown.length === 0} onChange={toggleAll} aria-label="Select all shown" />
              <span>{picked.length > 0 ? `${picked.length} selected` : plural(shown.length, 'item')}</span>
            </label>
            {picked.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {pickedNotes && (
                  <button type="button" className="btn" onClick={() => setDialog('file')}><FolderInput size={14} aria-hidden />Move to notebook</button>
                )}
                <span className="text-muted">Move to</span>
                <ChoiceChips label="Move to" value={target} options={[{ value: 'none', label: 'Unsorted' }, ...courses.map(c => ({ value: c.id, label: c.name, color: c.color }))]} onChange={setTarget} size="sm" />
                <button type="button" className="btn-primary" disabled={!target || moving} onClick={() => { void move() }}>Move</button>
              </div>
            )}
          </div>

          <span role="status" className="sr-only">{picked.length > 0 ? `${plural(picked.length, 'item')} selected` : ''}</span>
          {shown.length === 0 ? (
            shelf.length > 0 ? null : filtered && items.some(i => course === 'all' || (course === 'none' ? i.course_id === null : i.course_id === course)) ? (
              <div className="card space-y-2 py-8 text-center">
                <p className="text-sm">Nothing matches.</p>
                <button type="button" className="btn" onClick={() => { setView({ course: 'all', kind: null, q: '', sort: view.sort }); remember('course', null) }}>Clear filters</button>
              </div>
            ) : (
              <div className="card py-8 text-center text-sm text-muted">{course === 'none' ? 'Everything is in a course.' : courseName ? 'Nothing in this course yet.' : 'Nothing here yet.'}</div>
            )
          ) : (
            <section aria-label="Library items" className="space-y-8">
              {KINDS.filter(k => shown.some(i => i.kind === k)).map(kind => {
                const k = KIND[kind]
                const group = shown.filter(i => i.kind === kind)
                return (
                  <section key={kind} aria-labelledby={`lib-${kind}`}>
                    <h2 id={`lib-${kind}`} className="section-label flex items-center gap-2">
                      <k.icon size={17} className="text-accent" aria-hidden />{k.heading}<span className="text-[15px] font-normal text-muted">{group.length}</span>
                    </h2>
                    <ItemList label={k.heading} layout={layout}>
                      {group.map(i => {
                        const movable = isMovable(i)
                        const c = courseOf(i.course_id)
                        const book = i.kind === 'note' ? bookOf(i.notebook_id) : null
                        return (
                          <ItemTile key={key(i)} layout={layout} icon={k.icon} color={c?.color} title={i.title} href={i.href}
                            subtitle={book ? `In ${book.name}` : undefined}
                            meta={<CourseTag course={c} />}
                            aside={[i.meta, day(i.at)].filter(Boolean).join(' · ')}
                            corner={
                              <input type="checkbox" className="size-4" checked={selected.has(key(i))} disabled={!movable} onChange={() => toggle(i)} aria-label={`Select ${i.title}`}
                                title={movable ? undefined : 'Quizzes stay with their note. Move the note to move its quiz.'} />
                            } />
                        )
                      })}
                    </ItemList>
                  </section>
                )
              })}
            </section>
          )}
          {items.some(i => !isMovable(i)) && <p className="mt-3 text-xs text-muted">Quizzes stay with their note. Move the note to move its quiz.</p>}
        </>
      )}

      <NotebookNameDialog open={dialog === 'new'} onClose={() => setDialog(null)} title="New notebook" submitLabel="Create"
        courses={courses} initialCourse={course !== 'all' && course !== 'none' ? course : null} onSubmit={(n, cid) => { void create(n, cid) }} />
      <MoveToNotebookDialog open={dialog === 'file'} onClose={() => setDialog(null)} notebooks={notebooks}
        onMove={id => { void file(bookOf(id)) }} onCreateAndMove={n => { void fileInNew(n) }} />
    </div>
  )
}

