'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowUpRight, FilePlus, FileText, FolderInput, FolderOpen, FolderPlus, Layers, ListChecks, MessagesSquare, Mic, Paperclip, Search, Upload, type LucideIcon, CheckSquare } from 'lucide-react'
import { CourseBar } from '@/components/planner/CourseBar'
import { CourseTag } from '@/components/ui/CourseTag'
import { ChoiceChips } from '@/components/ui/ChoiceChips'
import { EmptyState } from '@/components/ui/EmptyState'
import { ItemList, ItemTile } from '@/components/ui/ItemTile'
import { ViewOptions } from '@/components/ui/ViewOptions'
import { PageHeader } from '@/components/ui/PageHeader'
import { MoveToNotebookDialog, NotebookNameDialog } from '@/components/notes/NotebookDialogs'
import { NotebookCover } from '@/components/notes/NotebookCover'
import { UploadDialog } from '@/components/notes/UploadDialog'
import { notebookColor } from '@/lib/notes/notebooks'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { listCourses } from '@/lib/data/courses'
import { loadLibrary, moveItems } from '@/lib/data/library'
import { createNote } from '@/lib/data/notes'
import { createChat, findChat } from '@/lib/data/tutor'
import { NewNoteButton } from '@/components/quick/NewNoteButton'
import { createNotebook, listNotebooks, moveNotes } from '@/lib/data/notebooks'
import { requestUpload } from '@/lib/scan/events'
import { requestQuiz } from '@/lib/quiz/events'
import { useView } from '@/lib/ui/listView'
import { countsByKind, folders, isMovable, visible, withKnownNotebooks, type Kind, type LibraryItem, type View } from '@/lib/library/items'
import type { Course, Notebook } from '@/lib/types'
import { Working } from '@/components/ui/Working'
import { CardsMark, ChatMark, ChecklistMark, ComposeButton, FileMark, PhoneCount, PhoneEmpty, PhoneGroup, PhoneHeading, PhoneRow, PhoneSearch, PhoneTitle, SheetMark, StripMark, tick } from '@/components/ui/PhoneList'
import { ContextMenu, type MenuEntry } from '@/components/ui/ContextMenu'
import { rowDate } from '@/lib/notes/noteRows'
import { useScreen } from '@/lib/ui/useScreen'

// Each kind has its own section, in this order, named with its heading
const KIND: Record<Kind, { heading: string; icon: LucideIcon }> = {
  note: { heading: 'Notes', icon: FileText },
  deck: { heading: 'Decks', icon: Layers },
  lecture: { heading: 'Lectures', icon: Mic },
  quiz: { heading: 'Quizzes', icon: ListChecks },
  chat: { heading: 'Tutor chats', icon: MessagesSquare },
  file: { heading: 'Files', icon: Paperclip },
}
const KINDS = Object.keys(KIND) as Kind[]
// Each kind's small drawing in a phone's rows
const MARK: Record<Kind, (p: { color?: string }) => React.ReactNode> = { note: SheetMark, deck: CardsMark, lecture: StripMark, quiz: ChecklistMark, chat: ChatMark, file: FileMark }
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
  const [dialog, setDialog] = useState<null | 'new' | 'file' | 'upload'>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; item: LibraryItem } | null>(null) // an item's ⋯ menu
  // On a phone: the list notes apps have, and ticking things only after choosing Select
  const phone = useScreen() === 'phone'
  const [selecting, setSelecting] = useState(false)
  const [now] = useState(() => new Date())
  const router = useRouter()

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

  // A new note in the course the Library is showing (or none), opened to write in
  async function newNote() {
    try { router.push(`/notes/${(await createNote(supabase(), { course_id: courseName ? course : null })).id}`) } catch { toast('Couldn\'t create a note.') }
  }
  // An item's ⋯ menu, from its button or a right click: open it, and for a note or lecture, what the student can do with it
  function openMenu(e: React.MouseEvent, item: LibraryItem) {
    e.preventDefault()
    if (e.type === 'contextmenu') setMenu({ x: e.clientX, y: e.clientY, item })
    else { const r = e.currentTarget.getBoundingClientRect(); setMenu({ x: r.right, y: r.bottom + 4, item }) }
  }
  async function askTutor(i: LibraryItem) {
    try {
      const sb = supabase()
      const target = i.kind === 'lecture' ? { lecture_id: i.id } : { note_id: i.id }
      const chat = await findChat(sb, target) ?? await createChat(sb, { title: i.title.slice(0, 200) || 'New chat', ...target, course_id: i.course_id })
      router.push(`/tutor/${chat.id}`)
    } catch { toast('Couldn\'t open the tutor.') }
  }
  function menuFor(i: LibraryItem): MenuEntry[] {
    const open: MenuEntry = { label: i.kind === 'quiz' ? 'Take' : 'Open', icon: ArrowUpRight, onSelect: () => router.push(i.href) }
    const ask: MenuEntry = { label: 'Ask the tutor', icon: MessagesSquare, onSelect: () => { void askTutor(i) } }
    if (i.kind === 'note') return [open, 'sep', ask,
      { label: 'Make flashcards', icon: Layers, onSelect: () => router.push(`${i.href}?study=cards`) },
      { label: 'Quiz me', icon: ListChecks, onSelect: () => router.push(`${i.href}?study=quiz`) },
      { label: 'Summarise', icon: FileText, onSelect: () => router.push(`${i.href}?study=summary`) }]
    if (i.kind === 'lecture') return [open, 'sep', ask]
    return [open]
  }
  async function move() {
    if (!picked.length || !target || moving) return
    setMoving(true)
    const wanted = picked.length
    try {
      const n = await moveItems(supabase(), picked.map(i => ({ kind: i.kind, id: i.id })), target === 'none' ? null : target)
      toast(n === wanted ? `Moved ${plural(n, 'item')}.` : n === 0 ? 'Nothing was moved. Those items had changed.' : `Moved ${n} of ${plural(wanted, 'item')}. The others had changed.`)
      setSelected(new Set()); setTarget(''); setSelecting(false) // a phone leaves Select once the move is done
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
      setSelected(new Set()); setSelecting(false)
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
  if (!items) return <div><PageHeader title="Library" /><Working kind="load" size="sm" label="Loading" className="text-sm text-muted" /></div>

  const empty = items.length === 0 && notebooks.length === 0
  const phoneMenu: MenuEntry[] = [
    { label: 'New note', icon: FilePlus, onSelect: () => { void newNote() } },
    { label: 'Record lecture', icon: Mic, onSelect: () => router.push('/lectures/record') },
    { label: 'Upload file', icon: Upload, onSelect: () => setDialog('upload') },
    { label: 'New notebook', icon: FolderPlus, onSelect: () => setDialog('new') },
    { label: 'Quiz', icon: ListChecks, onSelect: requestQuiz },
    ...(courseName ? [{ label: 'Open course page', icon: FolderOpen, onSelect: () => router.push(`/courses/${course}`) }] : []),
    { label: 'Select', icon: CheckSquare, onSelect: () => setSelecting(true), disabled: empty },
    'sep',
    tick('Newest first', view.sort === 'recent', () => setView(v => ({ ...v, sort: 'recent' }))),
    tick('Name', view.sort === 'name', () => setView(v => ({ ...v, sort: 'name' }))),
  ]
  return (
    <div className={phone ? 'pb-24' : undefined}>
      {phone ? <PhoneTitle title="Library" menuLabel="Library options" menu={phoneMenu} selecting={selecting} onDone={() => { setSelecting(false); setSelected(new Set()) }} />
      : <PageHeader title="Library" actions={
        <>
          {!empty && courseName && <Link href={`/courses/${course}`} className="btn-ghost text-accent">Open course page</Link>}
          {/* Notes and Lectures live in the Library now: a note is written and a lecture recorded from here */}
          <NewNoteButton courseId={courseName ? course : null} className="btn" />
          <Link href="/lectures/record" className="btn"><Mic size={14} aria-hidden />Record lecture</Link>
          {!empty && (
            <>
              <button type="button" className="btn" onClick={() => setDialog('upload')}><Upload size={14} aria-hidden />Upload file</button>
              <button type="button" className="btn" onClick={() => setDialog('new')}><FolderPlus size={14} aria-hidden />New notebook</button>
              {/* decks and uploads are also made from the Create button; a quiz is started here on a phone */}
              <button type="button" className="btn md:hidden" onClick={requestQuiz}><ListChecks size={14} aria-hidden />Quiz</button>
            </>
          )}
        </>
      } />}
      {empty && phone ? (
        <PhoneEmpty>Every note, deck, lecture, quiz, tutor chat and uploaded file shows up here, sorted by course. Tap the button below to write your first note, or upload a file from the menu.</PhoneEmpty>
      ) : empty ? (
        <EmptyState icon={FolderOpen} tone="b" title="Your library starts here" body="Every note, deck, lecture, quiz, tutor chat and uploaded file shows up here, sorted by course. Bring your first material in.">
          <button type="button" className="btn-primary" onClick={requestUpload}><Upload size={14} aria-hidden />Upload</button>
          <button type="button" className="btn" onClick={() => setDialog('upload')}>Just keep a file</button>
          <Link href="/lectures/record" className="btn">Record a lecture</Link>
        </EmptyState>
      ) : (
        <>
          <div role="group" aria-label="Courses">
            <CourseBar courses={courses} selected={courses.some(c => c.id === course) ? course : null}
              onSelect={id => chooseCourse(id ?? 'all')} onChange={c => { setCourses(c); void load() }} // a deleted course frees its items, so read them again
              unsorted={{ active: course === 'none', onClick: () => chooseCourse('none') }} />
          </div>

          {phone && <PhoneSearch label="Search the library" value={view.q} onChange={q => setView(v => ({ ...v, q }))} className="mb-3" />}
          {phone && (
            <div role="group" aria-label="Kinds" className="no-scrollbar -mx-5 mb-5 flex gap-1.5 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&>*]:shrink-0">
              {KINDS.map(k => (
                <button key={k} type="button" aria-pressed={view.kind === k} onClick={() => setView(v => ({ ...v, kind: v.kind === k ? null : k }))}
                  className={`choice inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm pointer-coarse:py-2 transition ${view.kind === k ? 'border-transparent bg-accent-soft font-medium text-accent' : 'border-line bg-raised hover:bg-surface'}`}>
                  {KIND[k].heading} <span className="text-muted">{counts![k]}</span>
                </button>
              ))}
            </div>
          )}

          {/* On a computer the search, the kinds and the order sit in a column that stays in view while the items scroll */}
          <div className={phone ? undefined : 'lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-8'}>
          {!phone && (
            <aside aria-label="Find and filter" className="mb-5 space-y-5 lg:sticky lg:top-6 lg:mb-0 lg:self-start">
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
                <input className="input w-full pl-9" placeholder="Search the library" aria-label="Search the library" value={view.q} onChange={e => setView(v => ({ ...v, q: e.target.value }))} />
              </div>
              <div role="group" aria-label="Kinds" className="flex flex-wrap gap-1.5 lg:flex-col lg:gap-0.5">
                <button type="button" aria-pressed={view.kind === null} onClick={() => setView(v => ({ ...v, kind: null }))}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[15px] transition ${view.kind === null ? 'bg-accent-soft font-medium text-accent' : 'hover:bg-surface'}`}>
                  <FolderOpen size={16} aria-hidden className="shrink-0" />Everything <span className="ml-auto text-sm text-muted">{Object.values(counts!).reduce((n, c) => n + c, 0)}</span>
                </button>
                {KINDS.map(k => (
                  <button key={k} type="button" aria-pressed={view.kind === k} onClick={() => setView(v => ({ ...v, kind: v.kind === k ? null : k }))}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[15px] transition ${view.kind === k ? 'bg-accent-soft font-medium text-accent' : 'hover:bg-surface'}`}>
                    {(() => { const Icon = KIND[k].icon; return <Icon size={16} aria-hidden className="shrink-0" /> })()}
                    {KIND[k].heading} <span className="ml-auto text-sm text-muted">{counts![k]}</span>
                  </button>
                ))}
              </div>
              <div data-filter-row className="flex flex-wrap items-center gap-2">
                <ChoiceChips className="flex-nowrap" label="Sort" value={view.sort} options={[{ value: 'recent', label: 'Newest first' }, { value: 'name', label: 'Name' }]} onChange={v => setView(prev => ({ ...prev, sort: v as View['sort'] }))} />
                <ViewOptions page="library" sort={false} />
              </div>
            </aside>
          )}
          <div className="min-w-0">
          {shelf.length > 0 && (
            <section aria-labelledby="lib-notebooks" className="mb-7">
              {phone ? <PhoneHeading id="lib-notebooks">Notebooks</PhoneHeading> : <h2 id="lib-notebooks" className="section-label">Notebooks</h2>}
              <ul aria-label="Notebooks" className={phone ? 'no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-1' : 'flex flex-wrap gap-4'}>
                {shelf.map(({ notebook, count }) => (
                  <li key={notebook.id} className={phone ? 'w-24 shrink-0' : 'w-32'}>
                    <Link href={`/notebooks/${notebook.id}`} aria-label={`Open ${notebook.name}, ${plural(count, 'note')}`}
                      className="block w-full rounded-xl outline-none transition hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-accent">
                      <NotebookCover name={notebook.name} count={count} color={notebookColor(notebook, known ?? [], courses)} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(!phone || selecting) && <div className="mb-2 flex min-h-9 flex-wrap items-center justify-between gap-2 text-sm">
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
          </div>}

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
          ) : phone ? (
            <section aria-label="Library items">
              {KINDS.filter(k => shown.some(i => i.kind === k)).map(kind => {
                const Mark = MARK[kind]
                return (
                  <PhoneGroup key={kind} label={KIND[kind].heading}>
                    {shown.filter(i => i.kind === kind).map(i => {
                      const c = courseOf(i.course_id)
                      const book = i.kind === 'note' ? bookOf(i.notebook_id) : null
                      return (
                        <PhoneRow key={key(i)} href={i.href} title={i.title} mark={<Mark color={c?.color} />} date={rowDate(i.at, now)}
                          line={[book ? `In ${book.name}` : i.blurb || i.meta, c?.name].filter(Boolean).join(' · ')}
                          select={selecting && isMovable(i) ? { on: selected.has(key(i)), onToggle: () => toggle(i) } : undefined}
                          onContextMenu={selecting ? undefined : e => openMenu(e, i)} />
                      )
                    })}
                  </PhoneGroup>
                )
              })}
              <PhoneCount n={shown.length} one="item" many="items" />
            </section>
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
                            subtitle={book ? `In ${book.name}` : undefined} blurb={i.blurb}
                            onMenu={e => openMenu(e, i)} onContextMenu={e => openMenu(e, i)}
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
          </div>
          </div>
        </>
      )}

      {phone && !selecting && <ComposeButton label="New note" icon={FilePlus} onClick={() => { void newNote() }} />}
      {menu && <ContextMenu x={menu.x} y={menu.y} label={menu.item.title || 'Item'} items={menuFor(menu.item)} onClose={() => setMenu(null)} />}
      <NotebookNameDialog open={dialog === 'new'} onClose={() => setDialog(null)} title="New notebook" submitLabel="Create"
        courses={courses} initialCourse={course !== 'all' && course !== 'none' ? course : null} onSubmit={(n, cid) => { void create(n, cid) }} />
      {/* a fresh dialog each time it opens, so nothing from the last upload is left in it */}
      {dialog === 'upload' && <UploadDialog open keepOnly courses={courses} onClose={() => setDialog(null)} onKept={() => { void load() }} />}
      <MoveToNotebookDialog open={dialog === 'file'} onClose={() => setDialog(null)} notebooks={notebooks}
        onMove={id => { void file(bookOf(id)) }} onCreateAndMove={n => { void fileInNew(n) }} />
    </div>
  )
}

