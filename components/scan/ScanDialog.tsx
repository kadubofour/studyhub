'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, ImagePlus, Loader2 } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { AiError } from '@/components/ai/AiError'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { freeAllowanceText, usePlan } from '@/components/billing/usePlan'
import { supabase } from '@/lib/supabase/client'
import { listCourses } from '@/lib/data/courses'
import { localDayKey } from '@/lib/dates'
import { addFiles, countPdfPagesInBrowser, pageCount, runScan, type ScanPage } from '@/lib/scan/scanClient'
import { savedText } from '@/lib/scan/planner'
import { ScanPages } from './ScanPages'
import { NoteReview } from './NoteReview'
import { CardsReview } from './CardsReview'
import { PlannerReview } from './PlannerReview'
import type { Course } from '@/lib/types'
import type { ScanCardsResult, ScanNoteResult, ScanPlannerResult, ScanTarget } from '@/lib/ai/scan'

const TARGETS: [ScanTarget, string][] = [['note', 'A note'], ['cards', 'Flashcards'], ['planner', 'Planner tasks and classes']]
type Result = { target: 'note'; value: ScanNoteResult } | { target: 'cards'; value: ScanCardsResult } | { target: 'planner'; value: ScanPlannerResult }
type Problem = { code: string; message: string }
const release = (p?: ScanPage) => { if (p?.preview) URL.revokeObjectURL(p.preview) }

// Scan: add pages → reading → review, then save. The result type is preset by where Scan was
// opened and can be changed. Nothing is saved until the student presses Save in the review.
export function ScanDialog({ open, onClose, initialTarget, onSaved }: {
  open: boolean; onClose: () => void; initialTarget: ScanTarget; onSaved?: () => void
}) {
  const router = useRouter()
  const toast = useToast()
  const { profile } = useProfile()
  const plan = usePlan()
  const [stage, setStage] = useState<'add' | 'reading' | 'review'>('add')
  const [target, setTarget] = useState<ScanTarget>(initialTarget)
  const [pages, setPages] = useState<ScanPage[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [problem, setProblem] = useState<Problem | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const camera = useRef<HTMLInputElement>(null)
  const chooser = useRef<HTMLInputElement>(null)
  const retakeInput = useRef<HTMLInputElement>(null)
  const retaking = useRef<number | null>(null)
  const abort = useRef<AbortController | null>(null)
  const n = pageCount(pages)

  useEffect(() => { if (open) listCourses(supabase()).then(setCourses).catch(() => {}) }, [open])

  function close() {
    abort.current?.abort()
    abort.current = null
    pages.forEach(release)
    setPages([]); setStage('add'); setProblem(null); setResult(null); setTarget(initialTarget)
    onClose()
  }

  async function add(input: HTMLInputElement) {
    const files = Array.from(input.files ?? [])
    input.value = ''
    if (!files.length) return
    const r = await addFiles(pages, files, countPdfPagesInBrowser)
    setPages(r.pages)
    setProblem(r.error ? { code: 'pages', message: r.error } : null)
  }

  async function retake(input: HTMLInputElement) {
    const i = retaking.current
    const file = input.files?.[0]
    retaking.current = null
    input.value = ''
    if (i == null || !file) return
    const r = await addFiles([], [file], countPdfPagesInBrowser)
    if (r.error || r.pages[0]?.kind !== 'image') { setProblem({ code: 'pages', message: r.error ?? 'Retake a page with a photo.' }); return }
    release(pages[i])
    setPages(ps => ps.map((p, j) => (j === i ? r.pages[0] : p)))
    setProblem(null)
  }

  function move(i: number, by: -1 | 1) {
    setPages(ps => {
      const j = i + by
      if (j < 0 || j >= ps.length) return ps
      const next = [...ps];
      [next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  function remove(i: number) {
    release(pages[i])
    setPages(ps => ps.filter((_, j) => j !== i))
  }

  async function scan() {
    const controller = new AbortController()
    abort.current = controller
    setProblem(null); setStage('reading')
    try {
      const r = await runScan({ pages, target, userId: profile.id, today: localDayKey(new Date(), profile.timezone), signal: controller.signal })
      if (controller.signal.aborted) return
      if (r.ok) { setResult({ target, value: r.value } as Result); setStage('review') }
      else { setProblem({ code: r.code, message: r.message }); setStage('add') }
    } catch (e) {
      if ((e as { name?: string }).name !== 'AbortError') setProblem({ code: 'ai_failed', message: 'Couldn\'t reach the AI. Try again.' })
      setStage('add')
    } finally {
      if (abort.current === controller) abort.current = null
    }
  }

  function cancel() {
    abort.current?.abort() // the request stops, so it isn't charged; the uploads are deleted
    abort.current = null
    setStage('add')
  }

  function finished(message?: string) {
    if (message) toast(message)
    close()
    onSaved?.()
  }

  const scanAgain = () => { setResult(null); setStage('add') }

  return (
    <Dialog open={open} onClose={close} title="Scan pages">
      {stage === 'add' && (
        <div className="space-y-3">
          <label className="field"><span>Make</span>
            <select value={target} onChange={e => setTarget(e.target.value as ScanTarget)}>
              {TARGETS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn justify-center" onClick={() => camera.current?.click()}><Camera size={14} aria-hidden />Take photos</button>
            <button type="button" className="btn justify-center" onClick={() => chooser.current?.click()}><ImagePlus size={14} aria-hidden />Choose images or a PDF</button>
          </div>
          <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-label="Photos from camera" onChange={e => void add(e.currentTarget)} />
          <input ref={chooser} type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf,.pdf" className="sr-only" tabIndex={-1} aria-label="Images or a PDF to scan" onChange={e => void add(e.currentTarget)} />
          <input ref={retakeInput} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-label="Retake photo" onChange={e => void retake(e.currentTarget)} />
          {pages.length > 0
            ? <ScanPages pages={pages} onMove={move} onRemove={remove} onRetake={i => { retaking.current = i; retakeInput.current?.click() }} />
            : <p className="rounded-2xl border-2 border-dashed border-line px-4 py-6 text-center text-sm text-muted">Add up to 10 pages: photos of notes, slides, a whiteboard or a timetable, or one short PDF.</p>}
          {problem && <AiError code={problem.code} message={problem.message} />}
          {plan.billing && !plan.loading && !plan.isPremium && <p className="text-xs text-muted">{freeAllowanceText(plan.usedToday)}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={close}>Cancel</button>
            <button type="button" className="btn-primary" disabled={!pages.length} onClick={scan}>✦ Scan {n} page{n === 1 ? '' : 's'}</button>
          </div>
        </div>
      )}
      {stage === 'reading' && (
        <div className="flex flex-col items-center gap-3 py-8 text-center" role="status">
          <Loader2 size={26} className="animate-spin text-accent" aria-hidden />
          <p className="text-sm">Reading your pages…</p>
          <p className="text-xs text-muted">Usually 10–30 seconds.</p>
          <button type="button" className="btn mt-2" onClick={cancel}>Cancel scan</button>
        </div>
      )}
      {stage === 'review' && result?.target === 'note' && (
        <NoteReview result={result.value} courses={courses} onScanAgain={scanAgain}
          onSaved={id => { finished(); router.push(`/notes/${id}`) }} />
      )}
      {stage === 'review' && result?.target === 'cards' && (
        <CardsReview result={result.value} deckName="Scanned cards" onScanAgain={scanAgain}
          onSaved={count => finished(`Saved ${count} card${count === 1 ? '' : 's'}.`)} />
      )}
      {stage === 'review' && result?.target === 'planner' && (
        <PlannerReview result={result.value} courses={courses} onScanAgain={scanAgain}
          onSaved={saved => finished(savedText(saved))} />
      )}
    </Dialog>
  )
}
