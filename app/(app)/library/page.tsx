'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { FileText, FolderOpen, Layers, ListChecks, MessagesSquare, Mic, Search, Upload, type LucideIcon } from 'lucide-react'
import { CourseBar } from '@/components/planner/CourseBar'
import { CourseTag } from '@/components/ui/CourseTag'
import { ChoiceChips } from '@/components/ui/ChoiceChips'
import { EmptyState } from '@/components/ui/EmptyState'
import { NewNoteButton } from '@/components/quick/NewNoteButton'
import { PageHeader } from '@/components/ui/PageHeader'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { listCourses } from '@/lib/data/courses'
import { loadLibrary, moveItems } from '@/lib/data/library'
import { requestUpload } from '@/lib/scan/events'
import { countsByKind, isMovable, visible, type Kind, type LibraryItem, type View } from '@/lib/library/items'
import type { Course } from '@/lib/types'

const KIND: Record<Kind, { label: string; plural: string; icon: LucideIcon; tone: 'a' | 'b' | 'c' }> = {
  note: { label: 'Note', plural: 'Notes', icon: FileText, tone: 'b' },
  deck: { label: 'Deck', plural: 'Decks', icon: Layers, tone: 'a' },
  lecture: { label: 'Lecture', plural: 'Lectures', icon: Mic, tone: 'c' },
  quiz: { label: 'Quiz', plural: 'Quizzes', icon: ListChecks, tone: 'a' },
  chat: { label: 'Tutor chat', plural: 'Chats', icon: MessagesSquare, tone: 'b' },
}
const KINDS = Object.keys(KIND) as Kind[]
const key = (i: { kind: Kind; id: string }) => `${i.kind}:${i.id}`
const day = (iso: string) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '')
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

// Everything the student has made in one list: filter by course and kind, search, and move things between courses
export default function LibraryPage() {
  const toast = useToast()
  const fromAddress = useSearchParams().get('course')
  const [courses, setCourses] = useState<Course[]>([])
  const [coursesLoaded, setCoursesLoaded] = useState(false)
  const [items, setItems] = useState<LibraryItem[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [view, setView] = useState<View>(() => ({ course: fromAddress ?? 'all', kind: null, q: '', sort: 'recent' }))
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [target, setTarget] = useState('')
  const [moving, setMoving] = useState(false)

  const load = useCallback(async () => {
    try { setItems(await loadLibrary(supabase(), new Date())); setFailed(false) } catch { setFailed(true); setItems(null) }
  }, [])
  useEffect(() => {
    let live = true
    listCourses(supabase()).then(c => { if (live) { setCourses(c); setCoursesLoaded(true) } }).catch(() => {})
    loadLibrary(supabase(), new Date()).then(l => { if (live) { setItems(l); setFailed(false) } }).catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [])

  const courseOf = (id: string | null) => courses.find(c => c.id === id) ?? null
  // An address naming a course that is gone (or never was) shows everything instead of an empty list
  const course = view.course === 'all' || view.course === 'none' || !coursesLoaded || courses.some(c => c.id === view.course) ? view.course : 'all'
  const current: View = { ...view, course }
  const shown = items ? visible(items, current) : []
  const counts = items ? countsByKind(items, current) : null
  // Only what is shown can be moved, so a tick hidden by a filter never goes along unseen
  const movableShown = shown.filter(isMovable)
  const picked = movableShown.filter(i => selected.has(key(i)))
  const allShownPicked = movableShown.length > 0 && movableShown.every(i => selected.has(key(i)))
  const filtered = view.kind !== null || view.q.trim() !== '' || course !== 'all'
  const courseName = course !== 'all' && course !== 'none' ? courseOf(course)?.name : null

  function toggle(i: LibraryItem) {
    setSelected(s => { const n = new Set(s); if (n.has(key(i))) n.delete(key(i)); else n.add(key(i)); return n })
  }
  function toggleAll() {
    setSelected(s => { const n = new Set(s); for (const i of movableShown) { if (allShownPicked) n.delete(key(i)); else n.add(key(i)) } return n })
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

  if (failed) return (
    <div>
      <PageHeader title="Library" />
      <p role="alert" className="text-sm text-danger">Could not load your library. Check your connection.</p>
      <button type="button" className="btn mt-2" onClick={() => { void load() }}>Try again</button>
    </div>
  )
  if (!items) return <div><PageHeader title="Library" /><p className="text-sm text-muted">Loading…</p></div>

  return (
    <div>
      <PageHeader title="Library" actions={items.length > 0 && (
        <>
          {courseName && <Link href={`/courses/${course}`} className="btn-ghost text-accent">Open course page</Link>}
          <NewNoteButton className="btn" />
          <Link href="/flashcards?new=1" className="btn"><Layers size={14} aria-hidden />New deck</Link>
          <button type="button" className="btn" onClick={requestUpload}><Upload size={14} aria-hidden />Upload</button>
        </>
      )} />
      {items.length === 0 ? (
        <EmptyState icon={FolderOpen} tone="b" title="Your library starts here" body="Every note, deck, lecture, quiz and tutor chat you make shows up here, sorted by course. Bring your first material in.">
          <button type="button" className="btn-primary" onClick={requestUpload}><Upload size={14} aria-hidden />Upload</button>
          <Link href="/notes" className="btn">Write a note</Link>
        </EmptyState>
      ) : (
        <>
          <div role="group" aria-label="Courses">
            <CourseBar courses={courses} selected={courses.some(c => c.id === course) ? course : null}
              onSelect={id => setView(v => ({ ...v, course: id ?? 'all' }))} onChange={c => { setCourses(c); void load() }} // a deleted course frees its items, so read them again
              unsorted={{ active: course === 'none', onClick: () => setView(v => ({ ...v, course: 'none' })) }} />
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-48 flex-1">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
              <input className="input w-full pl-9" placeholder="Search the library" aria-label="Search the library" value={view.q} onChange={e => setView(v => ({ ...v, q: e.target.value }))} />
            </div>
            <ChoiceChips label="Sort" value={view.sort} options={[{ value: 'recent', label: 'Newest first' }, { value: 'name', label: 'Name' }]} onChange={v => setView(prev => ({ ...prev, sort: v as View['sort'] }))} />
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {KINDS.map(k => (
              <button key={k} type="button" aria-pressed={view.kind === k} onClick={() => setView(v => ({ ...v, kind: v.kind === k ? null : k }))}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition ${view.kind === k ? 'border-transparent bg-accent-soft font-medium text-accent' : 'border-line bg-raised hover:bg-surface'}`}>
                {KIND[k].plural} <span className="text-muted">{counts![k]}</span>
              </button>
            ))}
          </div>

          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
            <label className="flex items-center gap-2 text-muted">
              <input type="checkbox" checked={allShownPicked} disabled={movableShown.length === 0} onChange={toggleAll} aria-label="Select all shown" />
              <span>{picked.length > 0 ? `${picked.length} selected` : plural(shown.length, 'item')}</span>
            </label>
            {picked.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted">Move to</span>
                <ChoiceChips label="Move to" value={target} options={[{ value: 'none', label: 'Unsorted' }, ...courses.map(c => ({ value: c.id, label: c.name, color: c.color }))]} onChange={setTarget} size="sm" />
                <button type="button" className="btn-primary" disabled={!target || moving} onClick={() => { void move() }}>Move</button>
              </div>
            )}
          </div>

          <span role="status" className="sr-only">{picked.length > 0 ? `${plural(picked.length, 'item')} selected` : ''}</span>
          {shown.length === 0 ? (
            filtered && items.some(i => course === 'all' || (course === 'none' ? i.course_id === null : i.course_id === course)) ? (
              <div className="card space-y-2 py-8 text-center">
                <p className="text-sm">Nothing matches.</p>
                <button type="button" className="btn" onClick={() => setView({ course: 'all', kind: null, q: '', sort: view.sort })}>Clear filters</button>
              </div>
            ) : (
              <div className="card py-8 text-center text-sm text-muted">{course === 'none' ? 'Everything is in a course.' : courseName ? 'Nothing in this course yet.' : 'Nothing here yet.'}</div>
            )
          ) : (
            <ul className="space-y-2">
              {shown.map(i => {
                const k = KIND[i.kind]
                const movable = isMovable(i)
                return (
                  <li key={key(i)} className="card flex items-center gap-3 py-3">
                    <input type="checkbox" checked={selected.has(key(i))} disabled={!movable} onChange={() => toggle(i)} aria-label={`Select ${i.title}`}
                      title={movable ? undefined : 'Quizzes stay with their note. Move the note to move its quiz.'} />
                    <span aria-hidden className={`tile-${k.tone} flex size-10 shrink-0 items-center justify-center rounded-xl border border-line`}><k.icon size={18} className="text-accent" /></span>
                    <div className="min-w-0 flex-1">
                      <Link href={i.href} className="block truncate font-medium hover:text-accent">{i.title}<span className="sr-only"> ({k.label})</span></Link>
                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                        <span>{k.label}</span>
                        {i.meta && <span>{i.meta}</span>}
                        {i.at && <span>{day(i.at)}</span>}
                        <CourseTag course={courseOf(i.course_id)} />
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          {items.some(i => !isMovable(i)) && <p className="mt-3 text-xs text-muted">Quizzes stay with their note. Move the note to move its quiz.</p>}
        </>
      )}
    </div>
  )
}
