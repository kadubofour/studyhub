'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { AiError } from '@/components/ai/AiError'
import { useConfirm } from '@/components/providers/ConfirmProvider'
import { LecturePlayer, type PlayerHandle } from '@/components/lectures/LecturePlayer'
import { TranscriptView } from '@/components/lectures/TranscriptView'
import { supabase } from '@/lib/supabase/client'
import { deleteLecture, getLecture, partUrls, updateLecture, type Lecture } from '@/lib/data/lectures'
import { makeAiNote, makeFreeNote } from '@/lib/lectures/lectureNotes'
import { AskTutorButton } from '@/components/tutor/AskTutorButton'
import { TranscriptEditor } from '@/components/lectures/TranscriptEditor'
import { runAccurate } from '@/lib/lectures/accurate'
import { usePlan } from '@/components/billing/usePlan'
import { formatClock, type TranscriptLine } from '@/lib/lectures/time'

type Problem = { code: string; message: string }

export default function LecturePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const search = useSearchParams()
  const confirm = useConfirm()
  const plan = usePlan()
  const [lecture, setLecture] = useState<Lecture | null>(null)
  const [urls, setUrls] = useState<string[]>([])
  const [time, setTime] = useState(0)
  const player = useRef<PlayerHandle>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [problem, setProblem] = useState<Problem | null>(null)
  const [making, setMaking] = useState(false)
  const [editing, setEditing] = useState(false)
  const abort = useRef<AbortController | null>(null)
  const autoStarted = useRef(false)

  const load = useCallback(async () => {
    const sb = supabase()
    const l = await getLecture(sb, id)
    setLecture(l)
    setUrls(await partUrls(sb, l.parts).catch(() => []))
    return l
  }, [id])

  const accurate = useCallback(async (l: Lecture) => {
    const controller = new AbortController()
    abort.current = controller
    setProblem(null)
    try {
      const r = await runAccurate(l, { signal: controller.signal, onProgress: (done, total) => setProgress({ done, total }) })
      if (!r.ok) setProblem({ code: r.code, message: r.message })
      await load()
    } catch (e) {
      if ((e as { name?: string }).name !== 'AbortError') setProblem({ code: 'ai_failed', message: 'Couldn\'t reach the AI. Try again.' })
    } finally {
      setProgress(null)
    }
  }, [load])

  // "Accurate, after recording" was chosen: start it on arrival (a boolean, so the effect runs once)
  const wantAccurate = search.get('accurate') === '1'
  useEffect(() => {
    const sb = supabase()
    let live = true
    getLecture(sb, id).then(async l => {
      if (!live) return
      setLecture(l)
      setUrls(await partUrls(sb, l.parts).catch(() => []))
      if (wantAccurate && !autoStarted.current && l.transcript_source !== 'openai') { autoStarted.current = true; void accurate(l) }
    }).catch(() => setProblem({ code: 'not_found', message: 'This lecture doesn\'t exist.' }))
    // Leaving the page pauses the accurate transcript; the next visit offers to resume
    return () => { live = false; abort.current?.abort() }
  }, [id, accurate, wantAccurate])

  // ✦ with AI (2 actions), or free: the transcript as it is, paragraphed
  async function makeNote(withAi: boolean) {
    if (!lecture) return
    setMaking(true); setProblem(null)
    try {
      const sb = supabase()
      if (withAi) {
        const r = await makeAiNote(sb, lecture)
        if (!r.ok) { setProblem({ code: r.code, message: r.message }); setMaking(false); return }
        router.push(`/notes/${r.noteId}`)
      } else {
        router.push(`/notes/${await makeFreeNote(sb, lecture)}`)
      }
    } catch {
      setProblem({ code: 'save', message: 'Couldn\'t save the note. Try again.' }); setMaking(false)
    }
  }

  async function saveTranscript(lines: TranscriptLine[]) {
    if (!lecture) return
    await updateLecture(supabase(), lecture.id, { transcript: lines })
    setLecture({ ...lecture, transcript: lines })
    setEditing(false)
  }

  async function remove() {
    if (!lecture) return
    if (!await confirm({ title: 'Delete this lecture?', body: 'Its recording and transcript are deleted for good.', confirmLabel: 'Delete', danger: true })) return
    try { await deleteLecture(supabase(), lecture); router.push('/lectures') } catch { setProblem({ code: 'delete', message: 'Couldn\'t delete the lecture. Try again.' }) }
  }

  if (!lecture) return problem ? <p role="alert" className="text-sm text-danger">{problem.message}</p> : <p className="text-sm text-muted">Loading…</p>

  const done = lecture.parts.filter(p => p.transcribed).length
  const accurateDone = lecture.transcript_source === 'openai' && lecture.transcript_status === 'done'
  const resuming = done > 0 && !accurateDone
  // The live transcript stays until the accurate one is complete, so say which one is showing
  const halted = lecture.transcript_status === 'failed' ? 'stopped' : lecture.transcript_status === 'processing' && !progress ? 'paused' : null
  const statusText = accurateDone ? 'Accurate transcript'
    : lecture.transcript_source === 'browser' ? `Live transcript (free)${halted ? ` · accurate transcript ${halted}` : ''}`
      : lecture.transcript_status === 'failed' ? 'Transcript failed'
        : lecture.transcript.length ? 'Transcript' : 'No transcript'
  const free = !plan.loading && !plan.isPremium

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-medium">{lecture.title}</h1>
          <p className="text-xs text-muted">{new Date(lecture.recorded_at).toLocaleString()} · {formatClock(lecture.duration_seconds)}</p>
        </div>
        <button type="button" className="btn-ghost text-danger" onClick={remove}><Trash2 size={14} aria-hidden />Delete lecture</button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <LecturePlayer urls={urls} parts={lecture.parts} duration={lecture.duration_seconds} onTime={setTime} ref={player} />
          <div className="flex flex-wrap gap-2">
            {lecture.note_id
              ? <Link href={`/notes/${lecture.note_id}`} className="btn">Open note</Link>
              : (
                <>
                  <button type="button" className="btn-primary" disabled={making || !lecture.transcript.length} onClick={() => void makeNote(true)}>{making ? 'Making a note…' : '✦ Make a note'}</button>
                  <button type="button" className="btn" disabled={making || !lecture.transcript.length} onClick={() => void makeNote(false)}>Make a note (free)</button>
                </>
              )}
            {!accurateDone && !progress && (
              <button type="button" className="btn" onClick={() => (free
                ? setProblem({ code: 'premium_required', message: 'Accurate transcripts are a Premium feature.' })
                : void accurate(lecture))}>
                {resuming ? `↻ Resume accurate transcript (${done} of ${lecture.parts.length} parts done)` : '↻ Get accurate transcript'}
              </button>
            )}
            <AskTutorButton target={{ lecture_id: lecture.id }} title={lecture.title} courseId={lecture.course_id} />
            {free && !accurateDone && (
              <span className="self-center rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent">✦ Premium</span>
            )}
          </div>
          {!lecture.transcript.length && !lecture.note_id && <p className="text-xs text-muted">Making a note needs a transcript first.</p>}
          {progress && <p role="status" className="text-sm text-muted">Transcribing part {Math.min(progress.done + 1, progress.total)} of {progress.total}…</p>}
          {problem && <AiError code={problem.code} message={problem.message} />}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted">{statusText}</p>
          {lecture.transcript.length
            ? (editing
              ? <TranscriptEditor lines={lecture.transcript} onSave={saveTranscript} onCancel={() => setEditing(false)} />
              : (
                <>
                  {/* Not while an accurate transcript is being made: it would replace the edits */}
                  <button type="button" className="btn-ghost text-xs" disabled={!!progress} onClick={() => setEditing(true)}>Edit transcript</button>
                  <TranscriptView lines={lecture.transcript} currentTime={time} onSeek={t => player.current?.seek(t)} />
                </>
              ))
            : <p className="text-sm text-muted">No transcript yet.</p>}
        </div>
      </div>
    </div>
  )
}
