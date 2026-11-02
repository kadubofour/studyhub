'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Circle, CircleCheck, CircleDot } from 'lucide-react'
import { AiError } from '@/components/ai/AiError'
import { ChoiceChips } from '@/components/ui/ChoiceChips'
import { postAi } from '@/components/ai/aiFetch'
import { TopicEditor } from '@/components/progress/TopicEditor'
import { TopicResources } from '@/components/progress/TopicResources'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { startRevision } from '@/lib/tutor/revise'
import { listCourses } from '@/lib/data/courses'
import { listCourseMaterial, listTopicLinks, listTopicStats, saveCourseTopics } from '@/lib/data/topics'
import { applyUpdate, fromAi, tidy, toDrafts } from '@/lib/topics/edit'
import { STATUS_LABEL, evidence, progressLine } from '@/lib/topics/status'
import type { CourseMaterial, DraftTopic, TopicDraft, TopicLink, TopicStat, TopicStatus } from '@/lib/topics/types'
import type { Course } from '@/lib/types'
import { Working } from '@/components/ui/Working'

const ICON = { not_started: Circle, covered: CircleDot, weak: AlertTriangle, mastered: CircleCheck } as const
const TONE: Record<TopicStatus, string> = { not_started: 'text-muted', covered: 'text-accent', weak: 'text-danger', mastered: 'text-success' }
type Loaded = { stats: TopicStat[]; links: { topic_id: string; link: TopicLink }[]; material: CourseMaterial }
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

async function load(courseId: string): Promise<Loaded> {
  const sb = supabase()
  const [stats, links, material] = await Promise.all([listTopicStats(sb, courseId), listTopicLinks(sb, courseId), listCourseMaterial(sb, courseId)])
  return { stats, links, material }
}

function StatusChip({ status }: { status: TopicStatus }) {
  const Icon = ICON[status]
  return <span className={`inline-flex items-center gap-1 text-xs font-medium ${TONE[status]}`}><Icon size={13} aria-hidden />{STATUS_LABEL[status]}</span>
}

// Progress: each course's topics, where the student stands on them, and what to revise first
export function TopicsSection() {
  const toast = useToast()
  const router = useRouter()
  const [opening, setOpening] = useState<string | null>(null)
  const [courses, setCourses] = useState<Course[] | null>(null)
  const [courseId, setCourseId] = useState<string | null>(null)
  const [data, setData] = useState<Loaded | null>(null)
  const [editing, setEditing] = useState<{ list: TopicDraft[]; fresh: boolean; n: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<{ code: string; message: string } | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    // Only courses with something to build topics from (or topics already): a course with no real material has nothing to show here
    listCourses(supabase()).then(async cs => {
      const sb = supabase()
      const ok = await Promise.all(cs.map(async c => {
        try {
          const [stats, material] = await Promise.all([listTopicStats(sb, c.id), listCourseMaterial(sb, c.id)])
          return stats.length > 0 || material.notes.length + material.lectures.length >= 2
        } catch { return true } // a failed check shows the load error with Retry, not a vanished section
      }))
      const shown = cs.filter((_, i) => ok[i])
      setCourses(shown); setCourseId(shown[0]?.id ?? null)
    }).catch(() => setCourses([]))
  }, [])
  useEffect(() => {
    if (!courseId) return
    let live = true
    load(courseId).then(d => { if (live) setData(d) }).catch(() => { if (live) setLoadFailed(true) })
    return () => { live = false }
  }, [courseId, attempt])

  function pickCourse(id: string) { setData(null); setLoadFailed(false); setEditing(null); setProblem(null); setSaveError(null); setCourseId(id) }
  // A failed load is not an empty course: drafting then would replace the topics that are really there
  function retry() { setLoadFailed(false); setData(null); setAttempt(a => a + 1) }

  // Topics are found and saved in one step: there is nothing to fix before they count (Edit topics is there for the student who wants to)
  async function revise(t: TopicStat) {
    if (!courseId) return
    setOpening(t.topic_id)
    // Stays busy until the page changes, so a second tap cannot make another chat
    try { router.push(await startRevision(supabase(), { id: t.topic_id, name: t.name }, courseId)) }
    catch { toast('Couldn\'t open the tutor. Try again.'); setOpening(null) }
  }

  async function ask(mode: 'draft' | 'update') {
    if (!courseId || !data) return
    setBusy(true); setProblem(null)
    const r = await postAi<{ topics: DraftTopic[] }>('/api/ai/topics', { courseId, mode })
    if (!r.ok) { setBusy(false); setProblem({ code: r.error, message: r.message }); return }
    const list = mode === 'draft' ? fromAi(r.value.topics) : applyUpdate(toDrafts(data.stats, data.links), r.value.topics)
    try {
      await saveCourseTopics(supabase(), courseId, tidy(list))
      setData(await load(courseId)); toast(mode === 'draft' ? 'Topics found.' : 'Topics updated.')
    } catch { setProblem({ code: 'save_failed', message: 'Couldn\'t save the topics. Try again.' }) }
    setBusy(false)
  }
  // A course with enough notes and no topics gets them on its own, once per visit (a failure leaves the button to try again)
  const tried = useRef(new Set<string>())
  useEffect(() => {
    if (!courseId || !data || busy || editing || data.stats.length > 0 || tried.current.has(courseId)) return
    if (data.material.notes.length + data.material.lectures.length < 2) return
    tried.current.add(courseId)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void ask('draft')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, data, busy, editing])

  async function save(list: TopicDraft[]) {
    if (!courseId) return
    setSaving(true); setSaveError(null)
    try {
      await saveCourseTopics(supabase(), courseId, tidy(list))
      setData(await load(courseId)); setEditing(null); toast('Topics saved.')
    } catch { setSaveError('Couldn\'t save. Your changes are still here; try again.') } finally { setSaving(false) }
  }

  if (!courses) return null
  if (!courses.length) return null
  if (loadFailed) return (
    <section aria-label="Topics" className="card mt-4 space-y-2">
      <h2 className="font-semibold">Topics</h2>
      <p role="alert" className="text-sm text-danger">Couldn&apos;t load your topics. Check your connection.</p>
      <button type="button" className="btn" onClick={retry}>Try again</button>
    </section>
  )
  if (!data) return <section aria-label="Topics" className="card mt-4"><h2 className="mb-2 font-semibold">Topics</h2></section>

  const linked = new Set(data.links.map(l => `${l.link.kind}:${l.link.id}`))
  const unlinked = [...data.material.notes.map(n => `note:${n.id}`), ...data.material.lectures.map(l => `lecture:${l.id}`)].filter(k => !linked.has(k)).length

  return (
    <section aria-label="Topics" className="card mt-4 space-y-3">
      <div>
        <h2 className="font-semibold">Topics</h2>
        <p className="text-sm text-muted">The ideas in each course and how well you know them. Quizzes on your notes fill in the bars.</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Not while finding, saving or editing: a result for one course must not land in another, and edits must not vanish */}
        <ChoiceChips label="Topics course" value={courseId ?? ''} disabled={busy || saving || !!editing} options={courses.map(c => ({ value: c.id, label: c.name, color: c.color }))} onChange={pickCourse} size="sm" />
        {courseId && <Link href={`/courses/${courseId}`} className="btn-ghost text-accent">Open course page</Link>}
      </div>

      {editing ? (
        <TopicEditor key={editing.n} initial={editing.list} material={data.material} fresh={editing.fresh} saving={saving} error={saveError}
          onSave={list => { void save(list) }} onCancel={() => { setEditing(null); setSaveError(null) }} />
      ) : data.stats.length === 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-muted">Topics split this course into ideas you can revise one by one. They are being found from your notes and lectures.</p>
          {busy
            ? <Working kind="write" label="Finding topics" steps={['Reading the notes and lectures', 'Grouping them by idea', 'Naming each topic']} className="rounded-2xl bg-surface py-5" />
            : <button type="button" className="btn-primary" onClick={() => { void ask('draft') }}>Find topics</button>}
          <p className="text-xs text-muted">Uses 1 AI action.</p>
        </div>
      ) : (
        <>
          <p className="text-sm">{progressLine(data.stats)}</p>
          <ul className="divide-y divide-line">
            {data.stats.map(s => {
              const pct = s.answers_30d ? Math.round((s.correct_30d / s.answers_30d) * 100) : null
              return (
                <li key={s.topic_id} aria-label={s.name} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{s.name}</div>
                      <StatusChip status={s.status} />
                    </div>
                    <button type="button" className="btn shrink-0" aria-label={`Revise ${s.name}`} disabled={opening !== null} onClick={() => { void revise(s) }}>
                      {opening === s.topic_id ? 'Opening…' : 'Revise'}
                    </button>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface" role="img" aria-label={pct === null ? 'No quiz answers yet' : `${pct}% right`}>
                    <div className={`h-full rounded-full ${s.status === 'weak' ? 'bg-danger' : s.status === 'mastered' ? 'bg-success' : 'bg-accent'}`} style={{ width: `${pct ?? 0}%` }} />
                  </div>
                  <details className="mt-1 text-xs text-muted">
                    <summary className="cursor-pointer select-none py-1">Details</summary>
                    <p>{evidence(s)}</p>
                    <p>{plural(s.notes, 'note')}, {plural(s.lectures, 'lecture')}, {plural(s.decks, 'deck')}</p>
                    <TopicResources topicId={s.topic_id} topicName={s.name} />
                  </details>
                </li>
              )
            })}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" onClick={() => { setSaveError(null); setEditing(e => ({ list: toDrafts(data.stats, data.links), fresh: false, n: (e?.n ?? 0) + 1 })) }}>Rename or remove topics</button>
            {unlinked > 0 && (busy
              ? <Working kind="read" size="sm" label="Looking at the new material" className="text-sm text-muted" />
              : <button type="button" className="btn-ghost" onClick={() => { void ask('update') }}>Add new notes to topics</button>)}
          </div>
        </>
      )}
      {problem && <AiError code={problem.code} message={problem.message} />}
    </section>
  )
}
