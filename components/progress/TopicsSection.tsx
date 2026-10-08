'use client'
import { useEffect, useState } from 'react'
import { AlertTriangle, Circle, CircleCheck, CircleDot } from 'lucide-react'
import { AiError } from '@/components/ai/AiError'
import { postAi } from '@/components/ai/aiFetch'
import { TopicEditor } from '@/components/progress/TopicEditor'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { listCourses } from '@/lib/data/courses'
import { listCourseMaterial, listTopicLinks, listTopicStats, saveCourseTopics } from '@/lib/data/topics'
import { applyUpdate, fromAi, tidy, toDrafts } from '@/lib/topics/edit'
import { STATUS_LABEL, evidence, progressLine, weakSpots } from '@/lib/topics/status'
import type { CourseMaterial, DraftTopic, TopicDraft, TopicLink, TopicStat, TopicStatus } from '@/lib/topics/types'
import type { Course } from '@/lib/types'

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
    listCourses(supabase()).then(cs => { setCourses(cs); setCourseId(cs[0]?.id ?? null) }).catch(() => setCourses([]))
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

  async function ask(mode: 'draft' | 'update') {
    if (!courseId || !data) return
    setBusy(true); setProblem(null)
    const r = await postAi<{ topics: DraftTopic[] }>('/api/ai/topics', { courseId, mode })
    setBusy(false)
    if (!r.ok) { setProblem({ code: r.error, message: r.message }); return }
    const list = mode === 'draft' ? fromAi(r.value.topics) : applyUpdate(toDrafts(data.stats, data.links), r.value.topics)
    setSaveError(null); setEditing(e => ({ list, fresh: true, n: (e?.n ?? 0) + 1 }))
  }

  async function save(list: TopicDraft[]) {
    if (!courseId) return
    setSaving(true); setSaveError(null)
    try {
      await saveCourseTopics(supabase(), courseId, tidy(list))
      setData(await load(courseId)); setEditing(null); toast('Topics saved.')
    } catch { setSaveError('Couldn\'t save. Your changes are still here; try again.') } finally { setSaving(false) }
  }

  if (!courses) return null
  if (!courses.length) return <section aria-label="Topics" className="card mt-4"><h2 className="mb-2 font-semibold">Topics</h2><p className="text-sm text-muted">Add a course in the Planner to organise its notes into topics.</p></section>
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
  const weak = weakSpots(data.stats, new Date())

  return (
    <section aria-label="Topics" className="card mt-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Topics</h2>
        {/* Not while drafting, saving or editing: a result for one course must not land in another, and edits must not vanish */}
        <select className="input max-w-52" aria-label="Topics course" value={courseId ?? ''} disabled={busy || saving || !!editing} onChange={e => pickCourse(e.target.value)}>
          {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {editing ? (
        <TopicEditor key={editing.n} initial={editing.list} material={data.material} fresh={editing.fresh} saving={saving} error={saveError}
          onSave={list => { void save(list) }} onCancel={() => { setEditing(null); setSaveError(null) }} />
      ) : data.stats.length === 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-muted">Topics split a course into things you can revise one by one, and show which ones are strong or weak. The AI drafts them from this course&apos;s notes and lectures, and you fix them before they are saved.</p>
          <button type="button" className="btn-primary" disabled={busy} onClick={() => { void ask('draft') }}>{busy ? 'Drafting…' : 'Draft topics'}</button>
          <p className="text-xs text-muted">Uses 1 AI action. Needs at least two notes or lectures in this course.</p>
        </div>
      ) : (
        <>
          {weak.length > 0 ? (
            <div role="region" aria-label="Weak spots" className="rounded-xl bg-danger-soft p-3">
              <h3 className="mb-1 text-sm font-medium">Weak spots</h3>
              <ul className="space-y-0.5 text-sm">
                {weak.map(w => <li key={w.topic_id}><span className="font-medium">{w.name}</span> <span className="text-muted">{evidence(w)}</span></li>)}
              </ul>
            </div>
          ) : <p className="text-sm text-muted">Nothing weak right now</p>}
          <p className="text-sm">{progressLine(data.stats)}</p>
          <ul className="divide-y divide-line">
            {data.stats.map(s => (
              <li key={s.topic_id} aria-label={s.name} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2">
                <span className="font-medium">{s.name}</span>
                <StatusChip status={s.status} />
                <span className="basis-full text-xs text-muted">{evidence(s)}</span>
                <span className="basis-full text-xs text-muted">{plural(s.notes, 'note')}, {plural(s.lectures, 'lecture')}, {plural(s.decks, 'deck')}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn" onClick={() => { setSaveError(null); setEditing(e => ({ list: toDrafts(data.stats, data.links), fresh: false, n: (e?.n ?? 0) + 1 })) }}>Edit topics</button>
            {unlinked > 0 && <button type="button" className="btn" disabled={busy} onClick={() => { void ask('update') }}>{busy ? 'Looking…' : 'Update topics'}</button>}
          </div>
        </>
      )}
      {problem && <AiError code={problem.code} message={problem.message} />}
    </section>
  )
}
