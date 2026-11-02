'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { FileText, Layers, ListChecks, Mic, Paperclip, Pencil, Plus, Search, Share2, Trash2, UploadCloud, type LucideIcon } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { NotebookCover } from '@/components/notes/NotebookCover'
import { ShareDialog } from '@/components/share/ShareDialog'
import { NotebookNameDialog } from '@/components/notes/NotebookDialogs'
import { UploadDialog } from '@/components/notes/UploadDialog'
import { ExportMenu } from '@/components/notes/ExportMenu'
import { ItemList, ItemTile } from '@/components/ui/ItemTile'
import { useToast } from '@/components/providers/ToastProvider'
import { useConfirm } from '@/components/providers/ConfirmProvider'
import { supabase } from '@/lib/supabase/client'
import { deleteNotebook, listNotebooks, updateNotebook } from '@/lib/data/notebooks'
import { createNote } from '@/lib/data/notes'
import { createDeck } from '@/lib/data/decks'
import { listCourses } from '@/lib/data/courses'
import { loadLibrary } from '@/lib/data/library'
import { notebookColor } from '@/lib/notes/notebooks'
import type { Kind, LibraryItem } from '@/lib/library/items'
import type { Course, Notebook } from '@/lib/types'
import { PAGE_TITLE } from '@/components/ui/PageHeader'
import { BackLink } from '@/components/ui/BackLink'
import { Working } from '@/components/ui/Working'
import { CardsMark, ChecklistMark, FileMark, NotebookMark, PhoneGroup, PhoneRow, SheetMark, StripMark } from '@/components/ui/PhoneList'
import { useScreen } from '@/lib/ui/useScreen'
import { rowDate } from '@/lib/notes/noteRows'

// a small action on a phone is only its icon: no border, no padding
const ICON_BTN = 'grid size-10 place-items-center rounded-full text-muted hover:bg-surface hover:text-fg'
// A phone draws each as a row in a rounded group, as the Tutor, Practice and Library lists do
const MARK = { note: SheetMark, deck: CardsMark, lecture: StripMark, file: FileMark, quiz: ChecklistMark } as const
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
// What a notebook holds, in this order: each kind has its own section
const KINDS: { kind: Kind; heading: string; one: string; icon: LucideIcon }[] = [
  { kind: 'note', heading: 'Notes', one: 'note', icon: FileText },
  { kind: 'deck', heading: 'Decks', one: 'deck', icon: Layers },
  { kind: 'lecture', heading: 'Lectures', one: 'lecture', icon: Mic },
  { kind: 'file', heading: 'Materials', one: 'material', icon: Paperclip },
  { kind: 'quiz', heading: 'Quizzes', one: 'quiz', icon: ListChecks },
]

// A notebook is a study set: everything for one subject in one place. Notes, decks, recordings and uploaded files are made here, and
// a quiz follows its note. Whatever the student makes without choosing a notebook goes in General.
export default function NotebookPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [book, setBook] = useState<Notebook | null | undefined>(undefined) // undefined while loading, null when not found
  const [all, setAll] = useState<Notebook[]>([])
  const [items, setItems] = useState<LibraryItem[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [q, setQ] = useState('')
  const [dialog, setDialog] = useState<null | 'rename' | 'share' | 'deck' | 'material'>(null)
  const [now] = useState(() => new Date())
  const phone = useScreen() === 'phone'

  const [again, setAgain] = useState(0)
  const load = () => setAgain(n => n + 1) // read it all again (after something is added)
  useEffect(() => {
    let live = true
    const sb = supabase()
    Promise.all([listNotebooks(sb), loadLibrary(sb, new Date()), listCourses(sb).catch(() => [] as Course[])])
      .then(([bs, list, cs]) => { if (live) { setAll(bs); setItems(list); setCourses(cs); setBook(bs.find(b => b.id === id) ?? null) } })
      .catch(() => { if (live) setBook(null) })
    return () => { live = false }
  }, [id, again])

  if (book === undefined) return <Working kind="load" size="sm" label="Loading" className="text-sm text-muted" />
  if (book === null) return (
    <div className="py-10 text-center">
      <h1 className="font-display text-2xl font-semibold">Notebook not found</h1>
      <p className="mt-1 text-sm text-muted">It may have been deleted.</p>
      <Link href="/library" className="btn mt-4">Go to Library</Link>
    </div>
  )

  const inside = items.filter(i => i.notebook_id === book.id)
  const color = notebookColor(book, items.filter(i => i.kind === 'note').map(i => ({ notebook_id: i.notebook_id, course_id: i.course_id })), courses)
  const needle = q.trim().toLowerCase()
  const summary = KINDS.map(k => ({ k, n: inside.filter(i => i.kind === k.kind).length })).filter(x => x.n > 0).map(x => plural(x.n, x.k.one)).join(' · ') || 'Nothing in it yet'
  const shown = inside.filter(i => !needle || (i.title || 'Untitled').toLowerCase().includes(needle))
  const isGeneral = !!book.is_default

  async function newNote() {
    try { const n = await createNote(supabase(), { notebook_id: book!.id, course_id: book!.course_id ?? null }); router.push(`/notes/${n.id}`) } catch { toast("Couldn't create a note.") }
  }
  async function newDeck(name: string) {
    setDialog(null)
    try { const d = await createDeck(supabase(), { name, notebook_id: book!.id, course_id: book!.course_id ?? null }); router.push(`/flashcards/${d.id}`) } catch { toast("Couldn't make that deck.") }
  }
  async function rename(name: string, cid: string | null) {
    setDialog(null)
    const before = book!
    setBook({ ...before, name, course_id: cid })
    try { await updateNotebook(supabase(), before.id, { name, course_id: cid }) } catch { setBook(before); toast("Couldn't save the notebook.") }
  }
  async function remove() {
    if (!await confirm({ title: 'Delete this notebook?', body: `“${book!.name}” will be deleted. Everything in it moves to General.`, confirmLabel: 'Delete', danger: true })) return
    try { await deleteNotebook(supabase(), book!.id); router.push('/library') } catch { toast("Couldn't delete the notebook.") }
  }

  return (
    <div>
      <BackLink href="/library">Library</BackLink>
      {/* a computer: the cover beside the title and labelled buttons; a phone: a small mark beside the title, and a row of plain icons */}
      <div className={phone ? 'mb-6' : 'mb-8 flex flex-wrap items-end gap-6'}>
        {phone ? (
          <div className="flex items-center gap-3">
            <NotebookMark color={color} />
            <div className="min-w-0 flex-1">
              <h1 className={`${PAGE_TITLE} truncate`}>{book.name}</h1>
              <p className="mt-0.5 text-[14px] text-muted">{summary}</p>
            </div>
          </div>
        ) : (
          <div data-testid="notebook-cover" className="w-28 shrink-0 sm:w-32"><NotebookCover name={book.name} count={inside.length} color={color} /></div>
        )}
        <div className="min-w-0 flex-1">
          {!phone && <><h1 className={PAGE_TITLE}>{book.name}</h1><p className="mt-1.5 text-[15px] text-muted">{summary}</p></>}
          <div className={phone ? 'mt-4 flex items-center gap-1' : 'mt-4 flex flex-wrap gap-2'}>
            {phone ? (
              <>
                <button type="button" aria-label="New note" title="New note" className="grid size-10 place-items-center rounded-full bg-fg text-bg" onClick={() => { void newNote() }}><Plus size={18} aria-hidden /></button>
                <Link href={`/lectures/record?notebook=${book.id}`} aria-label="Record lecture" title="Record lecture" className={ICON_BTN}><Mic size={19} aria-hidden /></Link>
                <button type="button" aria-label="New deck" title="New deck" className={ICON_BTN} onClick={() => setDialog('deck')}><Layers size={19} aria-hidden /></button>
                <button type="button" aria-label="Materials" title="Materials" className={ICON_BTN} onClick={() => setDialog('material')}><UploadCloud size={19} aria-hidden /></button>
                <button type="button" aria-label="Rename" title="Rename" className={ICON_BTN} onClick={() => setDialog('rename')}><Pencil size={18} aria-hidden /></button>
                <ExportMenu iconOnly ids={inside.filter(i => i.kind === 'note').map(i => i.id)} label="Export notes" disabled={!inside.some(i => i.kind === 'note')} />
                <button type="button" aria-label="Share" title="Share" className={ICON_BTN} onClick={() => setDialog('share')}><Share2 size={18} aria-hidden /></button>
                {!isGeneral && <button type="button" aria-label="Delete notebook" title="Delete notebook" className={`${ICON_BTN} hover:!text-danger`} onClick={() => { void remove() }}><Trash2 size={18} aria-hidden /></button>}
              </>
            ) : (
              <>
                <button type="button" className="btn-primary" onClick={() => { void newNote() }}><Plus size={15} aria-hidden />New note</button>
                <Link href={`/lectures/record?notebook=${book.id}`} className="btn"><Mic size={14} aria-hidden />Record lecture</Link>
                <button type="button" className="btn" onClick={() => setDialog('deck')}><Layers size={14} aria-hidden />New deck</button>
                <button type="button" className="btn" onClick={() => setDialog('material')}><UploadCloud size={14} aria-hidden />Materials</button>
                <button type="button" className="btn" onClick={() => setDialog('rename')}><Pencil size={14} aria-hidden />Rename</button>
                <ExportMenu ids={inside.filter(i => i.kind === 'note').map(i => i.id)} label="Export notes" disabled={!inside.some(i => i.kind === 'note')} />
                <button type="button" className="btn" onClick={() => setDialog('share')}><Share2 size={14} aria-hidden />Share</button>
                {!isGeneral && <button type="button" className="btn-ghost hover:!text-danger" onClick={() => { void remove() }}><Trash2 size={14} aria-hidden />Delete notebook</button>}
              </>
            )}
          </div>
        </div>
      </div>

      {inside.length === 0 ? (
        <div className="rounded-2xl bg-surface px-4 py-10 text-center text-sm text-muted">
          Nothing in this notebook yet. Start a note, record a lecture, or add a PDF or slides with Materials.
          <div className="mt-3"><button type="button" className="btn" onClick={() => { void newNote() }}><Plus size={14} aria-hidden />New note</button></div>
        </div>
      ) : (
        <>
          <div className="relative mb-6 max-w-md">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <input className="input w-full pl-9" placeholder={`Search ${book.name}`} value={q} onChange={e => setQ(e.target.value)} aria-label="Search this notebook" />
          </div>
          {shown.length === 0 && <p className="py-2 text-sm text-muted">Nothing matches.</p>}
          <div className="space-y-8">
            {KINDS.filter(k => shown.some(i => i.kind === k.kind)).map(k => {
              const group = shown.filter(i => i.kind === k.kind).sort((a, b) => b.at.localeCompare(a.at))
              return (
                phone ? (
                  <PhoneGroup key={k.kind} label={`${k.heading} in ${book.name}`}>
                    {group.map(i => {
                      const Mark = MARK[k.kind as keyof typeof MARK]
                      return <PhoneRow key={`${i.kind}:${i.id}`} href={i.href} mark={<Mark color={courses.find(c => c.id === i.course_id)?.color} />} title={i.title}
                        date={i.at ? rowDate(i.at, now) : undefined} line={i.blurb || i.meta} />
                    })}
                  </PhoneGroup>
                ) : (
                <section key={k.kind} aria-labelledby={`nb-${k.kind}`}>
                  <h2 id={`nb-${k.kind}`} className="section-label flex items-center gap-2"><k.icon size={17} className="text-accent" aria-hidden />{k.heading}<span className="text-[15px] font-normal text-muted">{group.length}</span></h2>
                  <ItemList label={`${k.heading} in ${book.name}`} layout="list">
                    {group.map(i => (
                      <ItemTile key={`${i.kind}:${i.id}`} layout="list" icon={k.icon} color={courses.find(c => c.id === i.course_id)?.color} title={i.title} href={i.href} blurb={i.blurb}
                        aside={[i.meta, i.at ? formatDistanceToNow(new Date(i.at), { addSuffix: true }) : ''].filter(Boolean).join(' · ')} />
                    ))}
                  </ItemList>
                </section>
                )
              )
            })}
          </div>
        </>
      )}

      {dialog === 'share' && <ShareDialog kind="notebook" id={book.id} title={book.name} onClose={() => setDialog(null)} />}
      <NotebookNameDialog open={dialog === 'rename'} onClose={() => setDialog(null)} title="Rename notebook" submitLabel="Save" initial={book.name}
        courses={courses} initialCourse={book.course_id ?? null} onSubmit={(name, cid) => { void rename(name, cid) }} />
      <NotebookNameDialog open={dialog === 'deck'} onClose={() => setDialog(null)} title="New deck" submitLabel="Create" onSubmit={name => { void newDeck(name) }} />
      {dialog === 'material' && <UploadDialog open courses={courses} notebooks={all} notebookId={book.id} onClose={() => setDialog(null)} onKept={() => { void load() }} />}
      <span hidden data-now={now.getTime()} />
    </div>
  )
}
