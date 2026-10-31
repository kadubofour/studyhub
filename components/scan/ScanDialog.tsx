'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Camera, FileText, ImagePlus, Images, Layers, ScanLine } from 'lucide-react'
import { Working } from '@/components/ui/Working'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { DropZone } from '@/components/ui/DropZone'
import { OptionCards, type OptionCard } from '@/components/ui/OptionCards'
import { BTN_OUTLINE, BTN_SOLID } from '@/components/ui/buttonStyles'
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

const TARGET_CARDS: OptionCard[] = [
  { value: 'note', label: 'A note', description: 'The text on the pages, typed up', icon: FileText },
  { value: 'cards', label: 'Flashcards', description: 'Question and answer cards to revise', icon: Layers },
  { value: 'planner', label: 'Planner tasks and classes', description: 'From a timetable or a to-do list', icon: CalendarDays },
]
type Result = { target: 'note'; value: ScanNoteResult } | { target: 'cards'; value: ScanCardsResult } | { target: 'planner'; value: ScanPlannerResult }
type Problem = { code: string; message: string }
const release = (p?: ScanPage) => { if (p?.preview) URL.revokeObjectURL(p.preview) }

// Scan: add pages → reading → review, then save. The result type is preset by where Scan was
// opened and can be changed. Nothing is saved until the student presses Save in the review.
export function ScanDialog({ open, onClose, initialTarget, onSaved, initialFiles }: {
  open: boolean; onClose: () => void; initialTarget: ScanTarget; onSaved?: () => void; initialFiles?: File[]
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
  const chooseButton = useRef<HTMLButtonElement>(null)
  const focusAfterRemove = useRef<number | null>(null)
  const n = pageCount(pages)

  useEffect(() => { if (open) listCourses(supabase()).then(setCourses).catch(() => {}) }, [open])
  // Photos picked in Upload arrive with the dialog, so the student does not pick them again
  useEffect(() => {
    if (!open || !initialFiles?.length) return
    let live = true
    addFiles([], initialFiles, countPdfPagesInBrowser).then(r => { if (live) { setPages(r.pages); setProblem(r.error ? { code: 'pages', message: r.error } : null) } })
    return () => { live = false }
  }, [open, initialFiles])

  function close() {
    abort.current?.abort()
    abort.current = null
    pages.forEach(release)
    setPages([]); setStage('add'); setProblem(null); setResult(null); setTarget(initialTarget)
    onClose()
  }

  async function addList(files: File[]) {
    if (!files.length) return
    const r = await addFiles(pages, files, countPdfPagesInBrowser)
    setPages(r.pages)
    setProblem(r.error ? { code: 'pages', message: r.error } : null)
  }
  async function add(input: HTMLInputElement) {
    const files = Array.from(input.files ?? [])
    input.value = ''
    await addList(files)
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
    focusAfterRemove.current = i
    setPages(ps => ps.filter((_, j) => j !== i))
  }

  // After removing a page, keep focus in the dialog: on the page that took its place (or the
  // one before), or on "Choose images or a PDF" when no pages are left
  useEffect(() => {
    const i = focusAfterRemove.current
    if (i == null) return
    focusAfterRemove.current = null
    if (!pages.length) { chooseButton.current?.focus(); return }
    document.querySelector<HTMLButtonElement>(`[aria-label="Remove page ${Math.min(i, pages.length - 1) + 1}"]`)?.focus()
  }, [pages])

  async function scan() {
    setProblem(null)
    if (target === 'planner') {
      // Classes are matched to the student's courses, so the list must be there first
      try { setCourses(await listCourses(supabase())) } catch {
        setProblem({ code: 'courses', message: 'Couldn\'t load your courses. Check your connection and try again.' })
        return
      }
    }
    const controller = new AbortController()
    abort.current = controller
    setStage('reading')
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

  const takePhotos = <button type="button" className={BTN_OUTLINE} onClick={() => camera.current?.click()}><Camera size={14} aria-hidden />Take photos</button>
  const choose = <button ref={chooseButton} type="button" className={pages.length ? BTN_OUTLINE : BTN_SOLID} onClick={() => chooser.current?.click()}><ImagePlus size={14} aria-hidden />Choose images or a PDF</button>
  const subtitle = stage === 'review' ? 'Check what was read, then save it.' : stage === 'reading' ? 'This usually takes 10 to 30 seconds.' : 'Turn photos of notes, slides or a timetable into something you can study.'

  return (
    <Dialog open={open} onClose={close} title="Scan pages" icon={ScanLine} size="md" subtitle={subtitle}>
      {stage === 'add' && (
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-medium">What should it make?</p>
            <OptionCards label="Make" value={target} onChange={v => setTarget(v as ScanTarget)} options={TARGET_CARDS} />
          </div>
          <input ref={camera} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" tabIndex={-1} aria-label="Photos from camera" onChange={e => void add(e.currentTarget)} />
          <input ref={chooser} type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf,.pdf" className="sr-only" tabIndex={-1} aria-label="Images or a PDF to scan" onChange={e => void add(e.currentTarget)} />
          <input ref={retakeInput} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" tabIndex={-1} aria-label="Retake photo" onChange={e => void retake(e.currentTarget)} />
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Your pages</p>
              <span className="text-xs text-muted" aria-live="polite">{n} of 10</span>
            </div>
            <DropZone label="Drop pages to scan" onFiles={files => void addList(files)} className={pages.length ? 'p-3' : 'px-4 py-7 text-center'}>
              {pages.length > 0 ? (
                <div className="space-y-3">
                  <ScanPages pages={pages} onMove={move} onRemove={remove} onRetake={i => { retaking.current = i; retakeInput.current?.click() }} />
                  <div className="flex flex-wrap gap-2">{takePhotos}{choose}</div>
                </div>
              ) : (
                <>
                  <span aria-hidden className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent"><Images size={24} /></span>
                  <p className="mt-3 font-medium">Drop photos or a PDF here</p>
                  <p className="mx-auto mb-4 mt-1 max-w-xs text-xs text-muted">Add up to 10 pages: photos of notes, slides, a whiteboard or a timetable, or one short PDF.</p>
                  <div className="flex flex-wrap justify-center gap-2">{takePhotos}{choose}</div>
                </>
              )}
            </DropZone>
          </div>
          {problem && <AiError code={problem.code} message={problem.message} />}
          <DialogFooter note={plan.billing && !plan.loading && !plan.isPremium ? freeAllowanceText(plan.usedToday) : undefined}>
            <button type="button" className={BTN_OUTLINE} onClick={close}>Cancel</button>
            <button type="button" className={BTN_SOLID} disabled={!pages.length} onClick={scan}>✦ Scan {n} page{n === 1 ? '' : 's'}</button>
          </DialogFooter>
        </div>
      )}
      {stage === 'reading' && (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface px-4 py-9 text-center">
          <div className="flex -space-x-3" aria-hidden>
            {pages.filter(p => p.preview).slice(0, 4).map(p => (
              // eslint-disable-next-line @next/next/no-img-element -- a local photo preview (blob URL)
              <img key={p.id} src={p.preview ?? undefined} alt="" className="size-14 rounded-lg border-2 border-bg object-cover shadow" />
            ))}
          </div>
          <Working kind="scan" label="Reading your pages" steps={['Making out the handwriting', 'Following the layout', 'Putting it in order']} />
          <p className="text-xs text-muted">Usually 10–30 seconds.</p>
          <button type="button" className={`${BTN_OUTLINE} mt-1`} onClick={cancel}>Cancel scan</button>
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
        <PlannerReview result={result.value} courses={courses} onScanAgain={scanAgain} onPartialSave={() => onSaved?.()}
          onSaved={saved => finished(savedText(saved))} />
      )}
    </Dialog>
  )
}
