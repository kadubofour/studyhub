'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Mic } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { CourseTag } from '@/components/ui/CourseTag'
import { StorageMessage } from '@/components/settings/StorageCard'
import { supabase } from '@/lib/supabase/client'
import { listCourses } from '@/lib/data/courses'
import { audioUsed, listLectures, type LectureSummary, type TranscriptStatus } from '@/lib/data/lectures'
import { indexedDbStore, type LocalSession } from '@/lib/lectures/localStore'
import { finishRecording } from '@/lib/lectures/saveRecording'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useConfirm } from '@/components/providers/ConfirmProvider'
import { AUDIO_QUOTA_BYTES, formatClock, formatMb, storageState } from '@/lib/lectures/time'
import type { Course } from '@/lib/types'

const STATUS: Record<TranscriptStatus, string> = {
  none: 'No transcript', live: 'Live transcript', processing: 'Transcribing…', done: 'Accurate transcript', failed: 'Transcript failed',
}
// The live transcript stays until the accurate one is complete, so a stopped or paused accurate
// transcript still leaves the lecture with its live one
const statusOf = (l: LectureSummary) =>
  (l.transcript_source === 'browser' && (l.transcript_status === 'failed' || l.transcript_status === 'processing') ? 'Live transcript' : STATUS[l.transcript_status])
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

export default function LecturesPage() {
  const router = useRouter()
  const { profile } = useProfile()
  const confirm = useConfirm()
  const [lectures, setLectures] = useState<LectureSummary[] | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [used, setUsed] = useState(0)
  const [leftover, setLeftover] = useState<LocalSession | null>(null)
  const [recovering, setRecovering] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const sb = supabase()
    Promise.all([listLectures(sb), listCourses(sb), audioUsed(sb)])
      .then(([l, c, u]) => { setLectures(l); setCourses(c); setUsed(u) })
      .catch(() => setLectures([]))
    // Only this student's: a shared device may hold someone else's unsaved recording
    indexedDbStore().sessions().then(s => setLeftover(s.find(x => x.userId === profile.id) ?? null)).catch(() => {})
  }, [profile.id])

  async function discard() {
    if (!leftover) return
    if (!await confirm({ title: 'Discard this recording?', body: 'It was never saved, and it will be deleted from this device.', confirmLabel: 'Discard', danger: true })) return
    await indexedDbStore().remove(leftover.id).catch(() => {})
    setLeftover(null)
  }

  async function recover() {
    if (!leftover) return
    setRecovering(true); setError(null)
    try {
      const { id } = await finishRecording(supabase(), indexedDbStore(), leftover)
      router.push(`/lectures/${id}`)
    } catch (e) {
      setError((e as Error).message === 'nothing_recorded' ? 'Nothing was recorded in it.' : 'Couldn\'t upload it. Check your connection and try again.')
      setRecovering(false)
    }
  }

  const full = storageState(used) === 'full'
  const courseOf = (id: string | null) => courses.find(c => c.id === id)

  return (
    <div>
      <PageHeader title="Lectures" actions={!full && <Link href="/lectures/record" className="btn-primary"><Mic size={14} aria-hidden />Record</Link>} />
      {leftover && (
        <div role="status" className="card mb-4 space-y-2">
          <p className="text-sm">A recording wasn&apos;t saved: <b>{leftover.title}</b>.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" disabled={recovering} onClick={recover}>{recovering ? 'Saving…' : 'Recover unsaved recording'}</button>
            <button type="button" className="btn" disabled={recovering} onClick={discard}>Discard</button>
          </div>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        </div>
      )}
      <div className="mb-3 space-y-1">
        <p className="text-xs text-muted">{formatMb(used)} of {formatMb(AUDIO_QUOTA_BYTES)} audio</p>
        <StorageMessage used={used} />
      </div>
      {lectures?.length === 0 && <p className="card py-10 text-center text-sm text-muted">No lectures yet. Press Record at the start of your next lecture.</p>}
      <ul className="space-y-2">
        {lectures?.map(l => (
          <li key={l.id}>
            <Link href={`/lectures/${l.id}`} className="card flex flex-wrap items-center justify-between gap-2 hover:border-accent">
              <span className="font-medium">{l.title}</span>
              <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <CourseTag course={courseOf(l.course_id)} />
                <span>{day(l.recorded_at)}</span>
                <span>{formatClock(l.duration_seconds)}</span>
                <span>{statusOf(l)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
