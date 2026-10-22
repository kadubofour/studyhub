'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, FileUp, Loader2, Mic, Sparkles, UploadCloud } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { DropZone } from '@/components/ui/DropZone'
import { ChoiceChips } from '@/components/ui/ChoiceChips'
import { BTN_OUTLINE, BTN_SOLID } from '@/components/ui/buttonStyles'
import { MarkdownView } from '@/components/notes/MarkdownView'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { createNote } from '@/lib/data/notes'
import { fileKind } from '@/lib/import/fileKind'
import { requestScan } from '@/lib/scan/events'
import { isRecording } from '@/lib/lectures/recordingGuard'
import { useConfirm } from '@/components/providers/ConfirmProvider'
import type { Course } from '@/lib/types'
import { LimitPrompt } from '@/components/billing/LimitPrompt'

type Draft = { title: string; content_md: string; notice?: string; via?: 'ai' | 'text'; limit?: 'daily_limit' | 'fair_use' }

type Next = '' | 'summary' | 'cards' | 'quiz'
const NEXT: [Next, string][] = [['', 'Open the note'], ['summary', 'Open with Summary'], ['cards', 'Open with Flashcards'], ['quiz', 'Open with Quiz']]

// Upload a PDF, Word, PowerPoint or text file and review it before it becomes a note. Photos go to Scan, recordings to Lectures.
export function UploadDialog({ open, onClose, courses, onImported, onScan }: {
  open: boolean; onClose: () => void; courses: Course[]; onImported?: () => void; onScan?: (files: File[]) => void
}) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const { profile } = useProfile()
  const input = useRef<HTMLInputElement>(null)
  const [stage, setStage] = useState<'pick' | 'working' | 'review' | 'recording'>('pick')
  const [next, setNext] = useState<Next>('')
  const [working, setWorking] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [courseId, setCourseId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // Each pick gets a generation number; results from an earlier (cancelled) pick are ignored
  const generation = useRef(0)
  const abort = useRef<AbortController | null>(null)
  const savingRef = useRef(false)

  function reset() {
    generation.current++
    abort.current?.abort() // stops an in-flight AI conversion so it isn't paid for
    abort.current = null
    setStage('pick'); setDraft(null); setError(null); setCourseId(''); setNext('')
    if (input.current) input.current.value = ''
  }
  function close() { reset(); onClose() }

  async function pick(file: File) {
    setError(null)
    const kind = fileKind(file)
    if (!kind) {
      const old = /\.(doc|ppt)$/i.exec(file.name)?.[1]
      setError(old ? `Old .${old} files can't be read. Open it and save it as .${old}x first.` : 'Choose a PDF, Word, PowerPoint or text file, or a JPEG, PNG or WebP photo.')
      return
    }
    if (kind === 'image') { close(); (onScan ?? requestScan)([file]); return } // photos are read by Scan, with the photo
    if (kind === 'audio') { setStage('recording'); return }
    const gen = ++generation.current
    const controller = new AbortController()
    abort.current = controller
    setStage('working')
    try {
      let result: Draft
      if (kind === 'docx') {
        setWorking('Reading your Word document…')
        const { docxToNote } = await import('@/lib/import/docxToNote')
        result = await docxToNote(await file.arrayBuffer(), file.name)
      } else if (kind === 'pptx') {
        setWorking('Reading your slides…')
        const { pptxToNote } = await import('@/lib/import/pptxToNote')
        result = await pptxToNote(await file.arrayBuffer(), file.name)
      } else if (kind === 'text') {
        setWorking('Reading your file…')
        const { textToNote } = await import('@/lib/import/textToNote')
        result = textToNote(await file.arrayBuffer(), file.name)
      } else {
        setWorking('Reading your PDF with AI — headings, lists, tables and equations…')
        const { importPdf } = await import('@/lib/import/pdfImport')
        result = await importPdf(file, profile.id, controller.signal)
      }
      if (gen !== generation.current) return // cancelled meanwhile
      setDraft(result)
      setStage('review')
    } catch (e) {
      if (gen !== generation.current) return
      setStage('pick')
      setError(e instanceof Error && /MB|pages|limit/.test(e.message) ? e.message : 'Couldn\'t read that file. Try another one.')
    }
  }

  // Leaving this page stops a lecture that is recording, so the student is asked first, as with the sidebar links
  async function mayLeave(): Promise<boolean> {
    if (!isRecording()) return true
    return confirm({
      title: 'Stop recording?', confirmLabel: 'Leave', danger: true,
      body: 'Leaving this page stops the recording. What was recorded is kept on this device; save it from Lectures.',
    })
  }

  async function save() {
    if (!draft || savingRef.current) return
    savingRef.current = true; setSaving(true)
    try {
      if (!await mayLeave()) return
      const n = await createNote(supabase(), { title: draft.title.trim() || 'Imported note', content_md: draft.content_md, course_id: courseId || null })
      onImported?.()
      close()
      router.push(`/notes/${n.id}${next ? `?study=${next}` : ''}`)
    } catch {
      toast('Couldn\'t save the note.')
    } finally {
      savingRef.current = false; setSaving(false)
    }
  }

  const goToLectures = () => { void mayLeave().then(ok => { if (ok) { close(); router.push('/lectures') } }) }
  const chosenCourse = courses.find(c => c.id === courseId)

  return (
    <Dialog open={open} onClose={close} title="Upload material" icon={FileUp} size="md"
      subtitle={stage === 'review' ? 'Check it over, then save it as a note.' : 'Turn a PDF, slides or a document into a note you can study from.'}>
      {stage === 'pick' && (
        <div className="space-y-4">
          <DropZone label="Drop a file here" onFiles={f => void pick(f[0])} className="px-5 py-8 text-center">
            <span aria-hidden className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent"><UploadCloud size={24} /></span>
            <p className="mt-3 text-base font-medium">Drop a file here</p>
            <p className="mb-3 text-sm text-muted">or</p>
            <button type="button" className={BTN_SOLID} onClick={() => input.current?.click()}>Choose a file</button>
            <ul className="mt-4 flex flex-wrap justify-center gap-1.5" aria-label="Accepted files">
              {['PDF', 'Word', 'PowerPoint', 'Text'].map(t => <li key={t} className="rounded-md bg-raised px-2 py-0.5 text-xs text-muted ring-1 ring-line">{t}</li>)}
            </ul>
          </DropZone>
          <input ref={input} type="file" accept=".pdf,.docx,.pptx,.txt,.md,.markdown,.jpg,.jpeg,.png,.webp,.mp3,.m4a,.wav,.webm,.ogg,.mp4,.mov,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/markdown,image/*,audio/*,video/*"
            className="sr-only" aria-label="File to upload" onChange={e => { const f = e.target.files?.[0]; if (f) void pick(f) }} />
          {error && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <p className="flex items-start gap-2 text-xs text-muted"><Sparkles size={13} className="mt-0.5 shrink-0 text-accent" aria-hidden />
            <span>PDFs are structured by AI (OpenAI), which uses AI actions: headings, lists, tables and equations, up to 24 MB and 100 pages. Word, PowerPoint and text files are read here for free.</span></p>
          <div>
            <p className="section-label !mb-2">Something else?</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => { close(); (onScan ?? requestScan)([]) }}
                className="flex items-center gap-3 rounded-xl border border-line bg-raised p-3 text-left transition hover:bg-surface">
                <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface text-muted"><Camera size={17} /></span>
                <span><span className="block text-sm font-medium">Photos of notes or slides</span><span className="block text-xs text-muted">Read them with Scan</span></span>
              </button>
              <button type="button" onClick={goToLectures}
                className="flex items-center gap-3 rounded-xl border border-line bg-raised p-3 text-left transition hover:bg-surface">
                <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface text-muted"><Mic size={17} /></span>
                <span><span className="block text-sm font-medium">A lecture recording</span><span className="block text-xs text-muted">Record and transcribe in Lectures</span></span>
              </button>
            </div>
          </div>
        </div>
      )}
      {stage === 'recording' && (
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-xl bg-surface p-4">
            <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"><Mic size={17} /></span>
            <p className="text-sm">Audio and video files can&apos;t be uploaded yet. Lectures records live and transcribes as you go, and the transcript can become a note.</p>
          </div>
          <DialogFooter>
            <button type="button" className={BTN_OUTLINE} onClick={reset}>Choose another</button>
            <button type="button" className={BTN_SOLID} onClick={goToLectures}>Go to Lectures</button>
          </DialogFooter>
        </div>
      )}
      {stage === 'working' && (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface px-4 py-10 text-center" role="status">
          <Loader2 size={30} className="animate-spin text-accent" aria-hidden />
          <p className="text-sm font-medium">{working}</p>
          <p className="text-xs text-muted">You can cancel any time.</p>
          <button type="button" className={`${BTN_OUTLINE} mt-1`} onClick={reset}>Cancel upload</button>
        </div>
      )}
      {stage === 'review' && draft && (
        <div className="space-y-4">
          {draft.via === 'ai' && <p className="flex items-center gap-1.5 text-xs text-accent"><Sparkles size={13} aria-hidden />Structured by AI — check it before saving.</p>}
          {draft.limit
            ? <LimitPrompt kind={draft.limit} title={draft.notice} />
            : draft.notice && <p className="rounded-lg bg-accent-soft px-3 py-2 text-xs">{draft.notice}</p>}
          <label className="field"><span>Title</span><input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
          <div className="space-y-1.5">
            <p className="text-sm">Course</p>
            <ChoiceChips label="Course" size="sm" value={courseId} onChange={setCourseId} options={[{ value: '', label: 'No course' }, ...courses.map(c => ({ value: c.id, label: c.name }))]} />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm">After saving</p>
            <ChoiceChips label="After saving" size="sm" value={next} onChange={v => setNext(v as Next)} options={NEXT.map(([value, label]) => ({ value, label }))} />
          </div>
          <div>
            <p className="section-label !mb-1.5">Preview</p>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-line bg-raised px-3 py-2" aria-label="Preview" tabIndex={0} role="region">
              <MarkdownView source={draft.content_md || '*This file had no text.*'} />
            </div>
          </div>
          <DialogFooter note={chosenCourse ? `In ${chosenCourse.name}` : undefined}>
            <button type="button" className={BTN_OUTLINE} onClick={reset}>Choose another</button>
            <button type="button" className={BTN_SOLID} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save note'}</button>
          </DialogFooter>
        </div>
      )}
    </Dialog>
  )
}
