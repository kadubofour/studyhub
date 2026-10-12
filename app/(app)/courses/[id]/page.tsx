'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { AlertTriangle, Circle, CircleCheck, CircleDot, FileText, FolderOpen, Layers, ListChecks, MessagesSquare, Mic, Upload, type LucideIcon } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { loadCoursePage, type CoursePage } from '@/lib/data/coursePage'
import { createChat } from '@/lib/data/tutor'
import { requestUpload } from '@/lib/scan/events'
import { startRevision } from '@/lib/tutor/revise'
import { cardsDue, courseSections, examLine, summaryLine } from '@/lib/course/summary'
import { STATUS_LABEL, evidence, progressLine, weakSpots } from '@/lib/topics/status'
import type { Kind } from '@/lib/library/items'
import type { TopicStatus } from '@/lib/topics/types'

const KIND: Record<Kind, { plural: string; icon: LucideIcon; tone: 'a' | 'b' | 'c' }> = {
  note: { plural: 'Notes', icon: FileText, tone: 'b' },
  deck: { plural: 'Decks', icon: Layers, tone: 'a' },
  lecture: { plural: 'Lectures', icon: Mic, tone: 'c' },
  quiz: { plural: 'Quizzes', icon: ListChecks, tone: 'a' },
  chat: { plural: 'Tutor chats', icon: MessagesSquare, tone: 'b' },
}
const STATUS_ICON = { not_started: Circle, covered: CircleDot, weak: AlertTriangle, mastered: CircleCheck } as const
const STATUS_TONE: Record<TopicStatus, string> = { not_started: 'text-muted', covered: 'text-accent', weak: 'text-danger', mastered: 'text-success' }
const day = (iso: string) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '')
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

// One study space for a course: what is in it, what is due, the next exam, its topics, and ways to start studying
export default function CoursePageRoute() {
  const id = String(useParams<{ id: string }>().id)
  const router = useRouter()
  const toast = useToast()
  const { profile } = useProfile()
  const [now] = useState(() => new Date())
  const [data, setData] = useState<CoursePage | null | undefined>(undefined) // undefined: loading, null: no such course
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try { setData(await loadCoursePage(supabase(), id, new Date())); setFailed(false) } catch { setFailed(true) }
  }, [id])
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
  if (data === undefined) return <p className="text-sm text-muted">Loading…</p>
  if (data === null) return (
    <EmptyState icon={FolderOpen} tone="b" title="Course not found" body="We couldn't find that course. It may have been deleted.">
      <Link href="/library" className="btn-primary">Go to Library</Link>
    </EmptyState>
  )

  const { course, items, topics, exam } = data
  const sections = items ? courseSections(items, course.id) : []
  const due = items ? cardsDue(items) : 0
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
      <header className="card flex flex-wrap items-center justify-between gap-3 border-l-8" style={{ borderLeftColor: course.color }}>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold">{course.name}</h1>
          <p className="text-sm text-muted">{items ? summaryLine(items) : ''}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn" onClick={requestUpload}><Upload size={14} aria-hidden />Upload</button>
          <button type="button" className="btn" disabled={busy !== null} onClick={() => { void ask() }}><MessagesSquare size={14} aria-hidden />Ask the tutor</button>
          <Link href={`/library?course=${course.id}`} className="btn-ghost text-accent">Open in Library</Link>
        </div>
      </header>

      {(due > 0 || exam) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {due > 0 && (
            <section aria-label="Cards due" className="card flex items-center justify-between gap-2">
              <span className="font-medium">{plural(due, 'card')} due</span>
              <Link href="/review" className="btn-primary">Review</Link>
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
          : topics.length === 0 ? <p className="text-sm text-muted">Topics group this course&apos;s notes so you can see what you know. <Link href="/progress" className="text-accent underline">Set up topics</Link></p>
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

      {items === null ? (
        <div role="alert" className="card text-sm text-danger">
          Could not load this course&apos;s material.
          <button type="button" className="btn ml-2" onClick={() => { void load() }}>Try again</button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={FolderOpen} tone="b" title={`Nothing in ${course.name} yet`} body="Notes, decks, lectures, quizzes and tutor chats you add to this course show up here.">
          <Link href="/notes" className="btn">Write a note</Link>
        </EmptyState>
      ) : sections.map(s => {
        const k = KIND[s.kind]
        return (
          <section key={s.kind} aria-label={k.plural} className="card">
            <div className="mb-2 flex items-center gap-2">
              <span aria-hidden className={`tile-${k.tone} flex size-8 items-center justify-center rounded-lg border border-line`}><k.icon size={16} className="text-accent" /></span>
              <h2 className="font-semibold">{k.plural}</h2>
              <span className="text-sm text-muted">{s.total}</span>
            </div>
            <ul className="divide-y divide-line">
              {s.shown.map(i => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-2">
                  <Link href={i.href} className="min-w-0 flex-1 truncate hover:text-accent">{i.title}</Link>
                  <span className="shrink-0 text-xs text-muted">{[i.meta, day(i.at)].filter(Boolean).join(' · ')}</span>
                </li>
              ))}
            </ul>
            {s.total > s.shown.length && <Link href={`/library?course=${course.id}`} className="mt-2 inline-block text-sm text-accent underline">See all {s.total} in Library</Link>}
          </section>
        )
      })}
    </div>
  )
}
