'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { AlertTriangle, Circle, CircleCheck, CircleDot, FolderOpen, Layers, MessagesSquare, Upload } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { BackLink } from '@/components/ui/BackLink'
import { PAGE_TITLE } from '@/components/ui/PageHeader'
import { NewNoteButton } from '@/components/quick/NewNoteButton'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { loadCoursePage, type CoursePage } from '@/lib/data/coursePage'
import { createChat } from '@/lib/data/tutor'
import { requestUpload } from '@/lib/scan/events'
import { startRevision } from '@/lib/tutor/revise'
import { cardsDue, examLine, summaryLine } from '@/lib/course/summary'
import { STATUS_LABEL, evidence, progressLine, weakSpots } from '@/lib/topics/status'
import type { TopicStatus } from '@/lib/topics/types'
import { Working } from '@/components/ui/Working'
import { MaterialBrowser } from '@/components/library/MaterialBrowser'
import { useScreen } from '@/lib/ui/useScreen'

const STATUS_ICON = { not_started: Circle, covered: CircleDot, weak: AlertTriangle, mastered: CircleCheck } as const
const STATUS_TONE: Record<TopicStatus, string> = { not_started: 'text-muted', covered: 'text-accent', weak: 'text-danger', mastered: 'text-success' }
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

// One study space for a course: what is in it, what is due, the next exam, its topics, and ways to start studying
// a small action on a phone is only its icon: no border, no padding
const ICON_BTN = 'grid size-10 place-items-center rounded-full text-muted hover:bg-surface hover:text-fg disabled:opacity-40'

export default function CoursePageRoute() {
  const id = String(useParams<{ id: string }>().id)
  const router = useRouter()
  const toast = useToast()
  const phone = useScreen() === 'phone'
  const { profile } = useProfile()
  const [now] = useState(() => new Date())
  const [data, setData] = useState<CoursePage | null | undefined>(undefined) // undefined: loading, null: no such course
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const inFlight = useRef(false) // set at once, before the next render, so a quick double tap loads once
  // A retry: if it fails the page that is already showing stays, with a message
  const load = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    try { setData(await loadCoursePage(supabase(), id, new Date())); setFailed(false) }
    catch { if (data) toast('Could not reload this course. Check your connection.'); else setFailed(true) }
    inFlight.current = false
  }, [id, data, toast])
  useEffect(() => {
    let live = true
    loadCoursePage(supabase(), id, new Date()).then(d => { if (live) { setData(d); setFailed(false) } }).catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [id])

  if (failed) return (
    <div>
      <p role="alert" className="text-sm text-danger">Could not load this course. Check your connection.</p>
      <button type="button" className="btn mt-2" onClick={() => { void load() }}>Try again</button>
    </div>
  )
  if (data === undefined) return <Working kind="load" size="sm" label="Loading" className="text-sm text-muted" />
  if (data === null) return (
    <EmptyState icon={FolderOpen} tone="b" title="Course not found" body="We couldn't find that course. It may have been deleted.">
      <Link href="/courses" className="btn-primary">Go to Courses</Link>
    </EmptyState>
  )

  const { course, items, topics, exam } = data
  const due = items ? cardsDue(items) : 0
  const dueDecks = items ? items.filter(i => i.kind === 'deck' && (i.due ?? 0) > 0) : []
  const weak = topics ? weakSpots(topics.map(t => ({ ...t })), now) : []
  const weakIds = new Set(weak.map(w => w.topic_id))

  async function revise(t: { topic_id: string; name: string }) {
    if (busy) return
    setBusy(t.topic_id)
    // Stays busy until the page changes, so a second tap cannot make another chat
    try { router.push(await startRevision(supabase(), { id: t.topic_id, name: t.name }, course.id)) } catch { toast('Couldn\'t open the tutor. Try again.'); setBusy(null) }
  }
  async function ask() {
    if (busy) return
    setBusy('ask')
    try { router.push(`/tutor/${(await createChat(supabase(), { title: course.name.slice(0, 200), course_id: course.id })).id}`) } catch { toast('Couldn\'t open the tutor. Try again.'); setBusy(null) }
  }

  return (
    <div className="space-y-4">
      <BackLink href="/courses">Courses</BackLink>
      {phone ? (
        // a phone: a small title with the actions as plain icons; no card and no course colour edge
        <header className="flex items-center justify-between gap-2 px-1">
          <div className="min-w-0">
            <h1 className="truncate font-display text-[1.35rem] font-bold leading-tight tracking-tight">{course.name}</h1>
            <p className="text-[13px] text-muted">{items ? summaryLine(items) : ''}</p>
          </div>
          <div className="flex shrink-0 items-center">
            <NewNoteButton courseId={course.id} iconOnly />
            <Link href={`/flashcards?new=1&course=${course.id}`} aria-label="New deck" title="New deck" className={ICON_BTN}><Layers size={19} aria-hidden /></Link>
            <button type="button" aria-label="Upload" title="Upload" className={ICON_BTN} onClick={requestUpload}><Upload size={19} aria-hidden /></button>
            <button type="button" aria-label="Ask the tutor" title="Ask the tutor" className={ICON_BTN} disabled={busy !== null} onClick={() => { void ask() }}><MessagesSquare size={19} aria-hidden /></button>
          </div>
        </header>
      ) : (
      <header className="card flex flex-wrap items-center justify-between gap-3 border-l-8" style={{ borderLeftColor: course.color }}>
        <div className="min-w-0">
          <h1 className={`${PAGE_TITLE} truncate`}>{course.name}</h1>
          <p className="text-sm text-muted">{items ? summaryLine(items) : ''}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <NewNoteButton courseId={course.id} className="btn" />
          <Link href={`/flashcards?new=1&course=${course.id}`} className="btn"><Layers size={14} aria-hidden />New deck</Link>
          <button type="button" className="btn" onClick={requestUpload}><Upload size={14} aria-hidden />Upload</button>
          <button type="button" className="btn" disabled={busy !== null} onClick={() => { void ask() }}><MessagesSquare size={14} aria-hidden />Ask the tutor</button>
        </div>
      </header>
      )}

      {(due > 0 || exam) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {due > 0 && (
            <section aria-label="Cards due" className="card flex items-center justify-between gap-2">
              <span className="font-medium">{plural(due, 'card')} due</span>
              {dueDecks.length === 1
                ? <Link href={`/review?deck=${dueDecks[0].id}`} className="btn-primary">Review</Link>
                : <Link href="/review" className="btn-primary">Review all courses</Link>}
            </section>
          )}
          {exam && (
            <section aria-label="Next exam" className="card flex items-center justify-between gap-2">
              <span className="font-medium">{examLine(exam, now, profile.timezone)}</span>
              <Link href="/planner" className="btn">Study plan in the Planner</Link>
            </section>
          )}
        </div>
      )}

      <section aria-label="Topics" className="card">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="font-semibold">Topics</h2>
          {topics && topics.length > 0 && <Link href="/progress" className="btn-ghost text-accent">Edit topics</Link>}
        </div>
        {topics === null ? <p role="alert" className="text-sm text-danger">Could not load the topics.</p>
          : topics.length === 0 ? <p className="text-sm text-muted">Topics are found on their own once this course has two notes or lectures, and show what you know. <Link href="/progress" className="text-accent underline">See them on Progress</Link></p>
          : (
            <>
              <p className="mb-2 text-xs text-muted">{progressLine(topics)}</p>
              <ul className="divide-y divide-line">
                {topics.map(t => {
                  const Icon = STATUS_ICON[t.status]
                  return (
                    <li key={t.topic_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{t.name}</span>
                          <span className={`inline-flex items-center gap-1 text-xs font-medium ${STATUS_TONE[t.status]}`}><Icon size={13} aria-hidden />{STATUS_LABEL[t.status]}</span>
                        </div>
                        {weakIds.has(t.topic_id) && <div className="text-xs text-muted">{evidence(t)}</div>}
                      </div>
                      {weakIds.has(t.topic_id) && (
                        <button type="button" className="btn" disabled={busy !== null} aria-label={`Revise ${t.name}`} onClick={() => { void revise(t) }}>
                          {busy === t.topic_id ? 'Opening…' : 'Revise'}
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </>
          )}
      </section>

      {/* Everything in the course: its notebooks first, then the rest by kind, searchable, with the same moving and menus as everywhere */}
      <MaterialBrowser course={course.id} embedded />
    </div>
  )
}
