'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ListChecks, Plus, Search, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { BTN_OUTLINE, BTN_SOLID } from '@/components/ui/buttonStyles'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useConfirm } from '@/components/providers/ConfirmProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { deleteQuiz, listQuizHub } from '@/lib/data/quizzes'
import { buildQuizHub, filterRows, type HubRow, type HubSort } from '@/lib/quiz/hub'
import { requestQuiz } from '@/lib/quiz/events'
import { useProgressChanged } from '@/lib/xp/events'

const SORTS: [HubSort, string][] = [['newest', 'Newest'], ['oldest', 'Oldest'], ['lowest', 'Lowest score'], ['most', 'Most taken']]

// The Quiz page: every quiz made, how each went, and where to go back to
export default function QuizHubPage() {
  const { profile } = useProfile()
  const confirm = useConfirm()
  const toast = useToast()
  const [data, setData] = useState<Awaited<ReturnType<typeof listQuizHub>> | null>(null)
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState('')
  const [course, setCourse] = useState('all')
  const [sort, setSort] = useState<HubSort>('newest')

  const latest = useRef(0)
  const load = useCallback(() => {
    const mine = ++latest.current // only the newest answer counts: an older, slower one must not bring back what was just deleted
    listQuizHub(supabase()).then(d => { if (mine === latest.current) { setData(d); setFailed(false) } }).catch(() => { if (mine === latest.current) setFailed(true) })
  }, [])
  useEffect(() => { load() }, [load])
  useProgressChanged(load) // a quiz finished or deleted elsewhere

  const hub = useMemo(() => (data ? buildQuizHub({ ...data, now: new Date() }) : null), [data])
  const courses = useMemo(() => [...new Map((hub?.rows ?? []).filter(r => r.courseId).map(r => [r.courseId!, r.courseName!])).entries()], [hub])
  const hasLoose = (hub?.rows ?? []).some(r => !r.courseId)
  // A course filter whose quizzes have all gone is not kept: it would leave an empty list with nothing to undo it
  const activeCourse = course === 'all' || (course === 'none' ? hasLoose : courses.some(([id]) => id === course)) ? course : 'all'
  const rows = useMemo(() => (hub ? filterRows(hub.rows, { query, course: activeCourse, sort }) : []), [hub, query, activeCourse, sort])
  const date = (iso: string) => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: profile.timezone }).format(new Date(iso))

  async function remove(r: HubRow) {
    if (!await confirm({ title: `Delete “${r.title}”?`, body: 'The quiz and its scores are removed, along with the XP and streak credit they earned. Your note stays.', confirmLabel: 'Delete', danger: true })) return
    try { await deleteQuiz(supabase(), r.id); setData(d => d && { ...d, quizzes: d.quizzes.filter(q => q.id !== r.id), attempts: d.attempts.filter(a => a.quiz_id !== r.id) }); toast('Quiz deleted.') }
    catch { toast('Couldn\'t delete that quiz.') }
  }

  const header = <PageHeader title="Quiz" actions={<button type="button" className={BTN_SOLID} onClick={requestQuiz}><Plus size={16} aria-hidden />New quiz</button>} />
  if (failed && !data) return <div>{header}<p role="alert" className="text-sm text-danger">Couldn&apos;t load your quizzes. <button type="button" className="underline" onClick={load}>Try again</button></p></div>
  if (!hub) return <div>{header}<p role="status" className="text-sm text-muted">Loading your quizzes…</p></div>
  if (hub.rows.length === 0) {
    return (
      <div>
        {header}
        <EmptyState icon={ListChecks} tone="a" title="No quizzes yet" body="Pick a note and Studyhub writes questions from it. Every quiz you make, and how each one went, is kept here.">
          <button type="button" className={BTN_SOLID} onClick={requestQuiz}><Plus size={16} aria-hidden />Make your first quiz</button>
        </EmptyState>
      </div>
    )
  }

  const { stats } = hub
  const tiles: [string, string, string][] = [
    ['Quizzes taken', String(stats.taken), `${stats.quizzes} made${stats.lastWeek ? ` · ${stats.lastWeek} this week` : ''}`],
    ['Average score', stats.average === null ? '–' : `${stats.average}%`, stats.taken ? 'across every attempt' : 'take one to see it'],
    ['Best score', stats.best === null ? '–' : `${stats.best}%`, 'on any quiz'],
    ['Questions right', String(stats.right), `of ${stats.answered} answered`],
  ]

  return (
    <div>
      {header}
      <section aria-label="Your quiz numbers" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(([label, value, hint]) => (
          <div key={label} className="card !p-4">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
            <p className="mt-0.5 text-xs text-muted">{hint}</p>
          </div>
        ))}
      </section>

      {stats.taken > 0 && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section aria-label="Recent scores" className="card">
            <h2 className="text-sm font-medium">Recent scores</h2>
            <div role="img" aria-label={hub.trend.length === 1 ? `Your last score: ${hub.trend[0].pct}%` : `Your last ${hub.trend.length} scores, oldest first: ${hub.trend.map(t => `${t.pct}%`).join(', ')}`} className="mt-3 flex h-28 items-end gap-1.5">
              {hub.trend.map(t => (
                <div key={t.id} title={`${t.title} · ${t.pct}% · ${date(t.finished_at)}`} className="flex h-full max-w-12 flex-1 items-end rounded-md bg-surface">
                  <div className="w-full rounded-md bg-accent-solid" style={{ height: `${Math.max(t.pct, 4)}%` }} />
                </div>
              ))}
            </div>
            <p className="mt-2 flex justify-between text-xs text-muted"><span>Oldest</span><span>Latest</span></p>
          </section>
          <section aria-label="Scores by course" className="card">
            <h2 className="text-sm font-medium">By course</h2>
            <p className="text-xs text-muted">Weakest first, so you know where to go back.</p>
            <ul className="mt-3 space-y-2.5">
              {hub.byCourse.map(c => (
                <li key={c.courseId ?? 'none'}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2"><span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: c.color ?? 'var(--line)' }} /><span className="truncate">{c.name}</span></span>
                    <span className="shrink-0 tabular-nums text-muted">{c.avgPct}% · {c.attempts} {c.attempts === 1 ? 'try' : 'tries'}</span>
                  </div>
                  <div aria-hidden className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-accent-solid" style={{ width: `${c.avgPct}%` }} /></div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {hub.needsWork.length > 0 && (
        <section aria-label="Worth another go" className="card mt-4">
          <h2 className="text-sm font-medium">Worth another go</h2>
          <p className="text-xs text-muted">Quizzes your last try scored under 60% on.</p>
          <ul className="mt-3 divide-y divide-line">
            {hub.needsWork.map(r => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <span className="min-w-0 truncate text-sm">{r.title}</span>
                <span className="flex shrink-0 items-center gap-3"><span className="text-sm tabular-nums text-muted">{r.lastPct}%</span><Link href={`/quiz/${r.id}`} className={BTN_OUTLINE}>Retake</Link></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="All quizzes" className="mt-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-sm font-medium">All quizzes <span className="font-normal text-muted">({hub.rows.length})</span></h2>
          <label className="relative">
            <Search size={14} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input type="search" aria-label="Search quizzes" placeholder="Search" value={query} onChange={e => setQuery(e.target.value)} className="!pl-8" />
          </label>
          {(courses.length > 0 || activeCourse !== 'all') && (
            <select aria-label="Course" value={activeCourse} onChange={e => setCourse(e.target.value)}>
              <option value="all">All courses</option>
              {courses.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              {hasLoose && <option value="none">No course</option>}
            </select>
          )}
          <select aria-label="Sort" value={sort} onChange={e => setSort(e.target.value as HubSort)}>
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        {rows.length === 0
          ? <p className="card text-sm text-muted">No quizzes match.</p>
          : (
            <ul className="space-y-2">
              {rows.map(r => (
                <li key={r.id} className="card flex flex-wrap items-center gap-3 !p-4">
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="truncate text-sm font-medium">{r.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                      {r.courseName && <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2 rounded-[3px]" style={{ background: r.courseColor ?? 'var(--line)' }} />{r.courseName}</span>}
                      {r.noteTitle ? <Link href={`/notes/${r.noteId}`} className="underline-offset-2 hover:underline">{r.noteTitle}</Link> : <span>Note deleted</span>}
                      <span>{r.questions} {r.questions === 1 ? 'question' : 'questions'}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {r.attempts === 0 ? 'Not taken yet' : `Taken ${r.attempts}× · best ${r.bestPct}% · last ${r.lastPct}% on ${date(r.lastAt!)}`}
                    </p>
                  </div>
                  <Link href={`/quiz/${r.id}`} className={r.attempts === 0 ? BTN_SOLID : BTN_OUTLINE}>{r.attempts === 0 ? 'Take' : 'Retake'}</Link>
                  <button type="button" className="btn-ghost text-muted hover:text-danger" aria-label={`Delete ${r.title}`} onClick={() => void remove(r)}><Trash2 size={16} aria-hidden /></button>
                </li>
              ))}
            </ul>
          )}
      </section>
    </div>
  )
}
