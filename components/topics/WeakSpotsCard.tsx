'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CourseTag } from '@/components/ui/CourseTag'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { listTopicStats } from '@/lib/data/topics'
import { startRevision } from '@/lib/tutor/revise'
import { evidence, weakSpots } from '@/lib/topics/status'
import type { TopicStat } from '@/lib/topics/types'
import type { Course } from '@/lib/types'

type Row = TopicStat & { courseId: string }
const SHOWN = 3

// Home: the topics most worth revising across all courses, each with a button that opens the tutor on it.
// Not there at all when there is nothing weak or stale (or while loading, or if loading fails).
export function WeakSpotsCard({ courses }: { courses: Course[] }) {
  const router = useRouter()
  const toast = useToast()
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!courses.length) return
    let live = true
    Promise.all(courses.map(c => listTopicStats(supabase(), c.id).then(stats => stats.map(s => ({ ...s, courseId: c.id })))))
      .then(all => { if (live) setRows(weakSpots(all.flat(), new Date()).slice(0, SHOWN)) })
      .catch(() => { if (live) setRows([]) })
    return () => { live = false }
  }, [courses])

  async function revise(r: Row) {
    setBusy(r.topic_id)
    // Stays busy until the page changes, so a second tap (here or on another row) cannot make another chat
    try { router.push(await startRevision(supabase(), { id: r.topic_id, name: r.name }, r.courseId)) }
    catch { toast('Couldn\'t open the tutor. Try again.'); setBusy(null) }
  }

  if (!rows.length) return null
  return (
    <section aria-label="Weak spots" className="card">
      <h2 className="section-label">Weak spots</h2>
      <ul className="divide-y divide-line">
        {rows.map(r => (
          <li key={r.topic_id} aria-label={r.name} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2"><span className="font-medium">{r.name}</span><CourseTag course={courses.find(c => c.id === r.courseId)} /></div>
              <div className="text-xs text-muted">{evidence(r)}</div>
            </div>
            <button type="button" className="btn" aria-label={`Revise ${r.name}`} disabled={busy !== null} onClick={() => { void revise(r) }}>
              {busy === r.topic_id ? 'Opening…' : 'Revise'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
