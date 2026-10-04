'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, Pause, Play, Square } from 'lucide-react'
import { useProfile } from '@/components/providers/ProfileProvider'
import { usePlan } from '@/components/billing/usePlan'
import { LimitPrompt } from '@/components/billing/LimitPrompt'
import { StorageMessage } from '@/components/settings/StorageCard'
import { supabase } from '@/lib/supabase/client'
import { listCourses } from '@/lib/data/courses'
import { audioUsed } from '@/lib/data/lectures'
import { createPartRecorder, pickAudioType, type RecorderCtor } from '@/lib/lectures/recorder'
import { createLiveTranscriber, type RecognitionCtor } from '@/lib/lectures/liveTranscript'
import type { LocalSession, RecordingStore, TranscriptChoice } from '@/lib/lectures/localStore'
import { finishRecording, uploadPartFile, withPart } from '@/lib/lectures/saveRecording'
import { setRecording } from '@/lib/lectures/recordingGuard'
import { MAX_LECTURE_SECONDS, WARN_LECTURE_SECONDS, formatClock, storageState, type TranscriptLine } from '@/lib/lectures/time'
import type { Course } from '@/lib/types'

export type RecorderDeps = {
  getUserMedia: (c: MediaStreamConstraints) => Promise<MediaStream>
  MediaRecorder: (RecorderCtor & { isTypeSupported(t: string): boolean }) | null
  Recognition: RecognitionCtor | null
  store: RecordingStore
  partSeconds: number
  /** Milliseconds, for measuring recording time (performance.now() unless a test supplies one) */
  now?: () => number
}
type Stage = 'setup' | 'recording' | 'saving' | 'failed'

// Record a lecture: before (title, course, transcript choice), during (clock, live transcript,
// Pause, Stop & save), then save and open it. Every part is uploaded while recording continues,
// and the device keeps a copy until the lecture is saved.
export function Recorder({ deps }: { deps: RecorderDeps }) {
  const router = useRouter()
  const { profile } = useProfile()
  const plan = usePlan()
  const [courses, setCourses] = useState<Course[]>([])
  const [used, setUsed] = useState(0)
  const [title, setTitle] = useState(() => `Lecture ${new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`)
  const [courseId, setCourseId] = useState('')
  const [choice, setChoice] = useState<TranscriptChoice>(deps.Recognition ? 'live' : 'none')
  const [stage, setStage] = useState<Stage>('setup')
  const [paused, setPaused] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [lines, setLines] = useState<TranscriptLine[]>([])
  const [interim, setInterim] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const session = useRef<LocalSession | null>(null)
  const recorder = useRef<ReturnType<typeof createPartRecorder> | null>(null)
  const live = useRef<ReturnType<typeof createLiveTranscriber> | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const clock = useRef<ReturnType<typeof setInterval> | null>(null)
  const stopping = useRef(false)
  const copyWarned = useRef(false)
  const [level, setLevel] = useState(0)
  const [metering, setMetering] = useState(false)
  const meter = useRef<{ ctx: AudioContext; timer: ReturnType<typeof setInterval> } | null>(null)
  const stopMeter = () => {
    if (meter.current) { clearInterval(meter.current.timer); void meter.current.ctx.close(); meter.current = null }
    setMetering(false)
  }

  // Microphone level, so the student can see it's hearing the lecturer (browsers without Web Audio skip it)
  function startMeter(media: MediaStream) {
    if (typeof AudioContext === 'undefined') return
    const ctx = new AudioContext()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    ctx.createMediaStreamSource(media).connect(analyser)
    const data = new Uint8Array(analyser.fftSize)
    const timer = setInterval(() => {
      analyser.getByteTimeDomainData(data)
      let sum = 0
      for (const v of data) sum += ((v - 128) / 128) ** 2
      setLevel(Math.min(1, Math.sqrt(sum / data.length) * 4))
    }, 100)
    meter.current = { ctx, timer }
    setMetering(true)
  }

  useEffect(() => {
    const sb = supabase()
    listCourses(sb).then(setCourses).catch(() => {})
    audioUsed(sb).then(setUsed).catch(() => {})
  }, [])
  // While recording: closing or reloading the tab warns, and the app's navigation asks first
  useEffect(() => {
    if (stage !== 'recording') return
    setRecording(true)
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => { setRecording(false); window.removeEventListener('beforeunload', warn) }
  }, [stage])

  const wake = useRef<WakeLockSentinel | null>(null)
  const releaseWake = () => { void wake.current?.release().catch(() => {}); wake.current = null }
  useEffect(() => () => {
    if (clock.current) clearInterval(clock.current)
    live.current?.stop() // otherwise speech recognition keeps restarting with the mic on after leaving
    releaseWake()
    stopMeter()
    stream.current?.getTracks().forEach(t => t.stop())
  }, [])

  const full = storageState(used) === 'full'
  const type = deps.MediaRecorder ? pickAudioType(t => deps.MediaRecorder!.isTypeSupported(t)) : null

  async function start() {
    if (!deps.MediaRecorder || !type) { setProblem('This browser can\'t record audio. Try Chrome, Edge or Safari.'); return }
    setProblem(null)
    let media: MediaStream
    try {
      media = await deps.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
    } catch (e) {
      setProblem((e as { name?: string }).name === 'NotAllowedError'
        ? 'Allow the microphone for this site: tap the lock or site-settings icon by the address, set Microphone to Allow, then try again.'
        : 'Couldn\'t find a microphone.')
      return
    }
    stream.current = media
    startMeter(media)
    const s: LocalSession = {
      id: crypto.randomUUID(), userId: profile.id, title, courseId: courseId || null, mime: type.mime, ext: type.ext,
      startedAt: new Date().toISOString(), choice, lines: [], parts: [{ index: 0, start: 0, duration: null, uploaded: null }],
    }
    session.current = s
    await deps.store.saveSession(s)
    const rec = createPartRecorder({
      stream: media, Ctor: deps.MediaRecorder, recorderType: type.recorderType, mime: type.mime, partSeconds: deps.partSeconds, now: deps.now,
      onChunk: (i, chunk) => {
        deps.store.addChunk(s.id, i, chunk).catch(() => {
          // Once is enough: recording and uploading carry on, only the device copy is missing
          if (copyWarned.current) return
          copyWarned.current = true
          setProblem('Couldn\'t keep a safety copy on this device (is it out of space?). Recording continues: keep this page open until it\'s saved.')
        })
      },
      onPart: async part => {
        // This part is finished and the next one (if recording goes on) has started, length
        // unknown. The device copy lists both before uploading, so a dead phone loses neither.
        let cur = withPart(session.current!, { index: part.index, start: part.start, duration: part.duration, uploaded: null })
        if (!cur.parts.some(p => p.index === part.index + 1)) {
          cur = withPart(cur, { index: part.index + 1, start: part.start + part.duration, duration: null, uploaded: null })
        }
        session.current = cur
        await deps.store.saveSession(cur)
        try {
          const uploaded = await uploadPartFile(supabase(), cur, part)
          // Merge into the latest session: live lines and later parts may have changed meanwhile
          const latest = session.current!
          const mine = latest.parts.find(p => p.index === part.index)!
          session.current = withPart(latest, { ...mine, uploaded })
          await deps.store.saveSession(session.current)
        } catch { /* kept on the device; Stop uploads it */ }
      },
    })
    recorder.current = rec
    rec.start()
    if (choice === 'live' && deps.Recognition) {
      live.current = createLiveTranscriber({
        Ctor: deps.Recognition, now: () => rec.elapsed(),
        onLine: line => {
          setLines(ls => [...ls, line])
          if (session.current) { session.current = { ...session.current, lines: [...session.current.lines, line] }; void deps.store.saveSession(session.current) }
        },
        onInterim: setInterim,
        onBlocked: () => setProblem('Live transcript was blocked; recording continues.'),
      })
      live.current.start()
    }
    setStage('recording')
    // Keep the screen on where the browser allows it: phones pause pages whose screen is off
    const wl = (navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<WakeLockSentinel> } }).wakeLock
    wl?.request('screen').then(l => { wake.current = l }).catch(() => {})
    clock.current = setInterval(() => {
      rec.tick()
      const t = rec.elapsed()
      setSeconds(t)
      if (t >= MAX_LECTURE_SECONDS) void stop()
    }, 1000)
  }

  function togglePause() {
    if (!recorder.current) return
    if (paused) { recorder.current.resume(); live.current?.start() } else { recorder.current.pause(); live.current?.stop() }
    setPaused(p => !p)
  }

  async function stop() {
    if (stopping.current || !recorder.current) return
    stopping.current = true
    if (clock.current) clearInterval(clock.current)
    live.current?.stop()
    setStage('saving')
    await recorder.current.stop()
    stopMeter()
    releaseWake()
    stream.current?.getTracks().forEach(t => t.stop())
    // The unfinished last part was closed by stop(); drop the empty "next part" placeholder
    if (session.current) session.current = { ...session.current, parts: session.current.parts.filter(p => p.duration != null || p.uploaded) }
    await save()
  }

  async function save() {
    const s = session.current
    if (!s) return
    setStage('saving'); setProblem(null)
    try {
      const { id } = await finishRecording(supabase(), deps.store, s)
      router.push(`/lectures/${id}${s.choice === 'accurate' ? '?accurate=1' : ''}`)
    } catch (e) {
      setStage('failed')
      setProblem((e as Error).message === 'nothing_recorded'
        ? 'Nothing was recorded.'
        : 'Couldn\'t upload the recording. It\'s kept on this device: check your connection, then Retry upload.')
    }
  }

  if (stage === 'setup') return (
    <div className="max-w-lg space-y-4">
      <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm">Ask your lecturer before recording.</p>
      <label className="field"><span>Title</span><input value={title} maxLength={200} onChange={e => setTitle(e.target.value)} /></label>
      <label className="field"><span>Course</span>
        <select value={courseId} onChange={e => setCourseId(e.target.value)}>
          <option value="">No course</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <fieldset className="space-y-1.5 text-sm">
        <legend className="mb-1 text-muted">Transcript</legend>
        <label className="flex items-center gap-2"><input type="radio" name="choice" checked={choice === 'live'} disabled={!deps.Recognition} onChange={() => setChoice('live')} />Live, free</label>
        {!deps.Recognition && <p className="pl-6 text-xs text-muted">This browser can&apos;t do live transcripts. Try Chrome, Edge or Safari, or choose Accurate.</p>}
        <label className="flex items-center gap-2"><input type="radio" name="choice" checked={choice === 'accurate'} onChange={() => setChoice('accurate')} />Accurate, after recording</label>
        <label className="flex items-center gap-2"><input type="radio" name="choice" checked={choice === 'none'} onChange={() => setChoice('none')} />None</label>
      </fieldset>
      {choice === 'accurate' && (plan.isPremium
        ? <p className="text-xs text-muted">The audio is sent to OpenAI to transcribe it (OpenAI&apos;s API data-use terms apply).</p>
        : <LimitPrompt kind="premium_required" />)}
      <StorageMessage used={used} />
      {problem && <p role="alert" className="text-sm text-danger">{problem}</p>}
      <button type="button" className="btn-primary" disabled={full} onClick={start}><Mic size={14} aria-hidden />Start recording</button>
    </div>
  )

  return (
    <div className="max-w-lg space-y-4">
      <div className="flex items-center gap-3">
        <span className={`size-3 rounded-full ${stage === 'recording' && !paused ? 'animate-pulse bg-danger' : 'bg-line'}`} aria-hidden />
        <span role="timer" className="font-mono text-3xl tabular-nums" aria-label="Recording time">{formatClock(seconds)}</span>
        {paused && <span className="text-sm text-muted">Paused</span>}
      </div>
      {metering && (
        <div role="meter" aria-label="Microphone level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)} className="h-2 w-full max-w-xs rounded-full bg-surface">
          <div className="h-2 rounded-full bg-accent transition-[width]" style={{ width: `${Math.round(level * 100)}%` }} />
        </div>
      )}
      {seconds >= WARN_LECTURE_SECONDS && stage === 'recording' && <p className="text-sm text-danger">Recording stops at 2 hours.</p>}
      {choice === 'live' && (
        <div className="max-h-64 overflow-y-auto rounded-xl border border-line p-3 text-sm" aria-live="polite" aria-label="Live transcript">
          {lines.map((l, i) => <p key={i}><span className="text-muted">{formatClock(l.start)}</span> {l.text}</p>)}
          {interim && <p className="text-muted">{interim}</p>}
          {!lines.length && !interim && <p className="text-muted">Listening…</p>}
        </div>
      )}
      {problem && <p role="alert" className="text-sm text-danger">{problem}</p>}
      {stage === 'recording' && (
        <div className="flex gap-2">
          <button type="button" className="btn" onClick={togglePause}>{paused ? <><Play size={14} aria-hidden />Resume</> : <><Pause size={14} aria-hidden />Pause</>}</button>
          <button type="button" className="btn-primary" onClick={() => void stop()}><Square size={14} aria-hidden />Stop &amp; save</button>
        </div>
      )}
      {stage === 'saving' && <p role="status" className="text-sm text-muted">Saving your lecture…</p>}
      {stage === 'failed' && <button type="button" className="btn-primary" onClick={() => void save()}>Retry upload</button>}
    </div>
  )
}
