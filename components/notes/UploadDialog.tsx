'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, FileUp, FolderOpen, Mic, Sparkles, UploadCloud } from 'lucide-react'
import { Working } from '@/components/ui/Working'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { DropZone } from '@/components/ui/DropZone'
import { ChoiceChips } from '@/components/ui/ChoiceChips'
import { BTN_OUTLINE, BTN_SOLID } from '@/components/ui/buttonStyles'
import { MarkdownView } from '@/components/notes/MarkdownView'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { createNote } from '@/lib/data/notes'
import { fileSize, keepMaterial, kindOfMime, updateMaterial, type MaterialKind } from '@/lib/data/materials'
import { fileKind } from '@/lib/import/fileKind'
import { requestScan } from '@/lib/scan/events'
import { isRecording } from '@/lib/lectures/recordingGuard'
import { useConfirm } from '@/components/providers/ConfirmProvider'
import type { Course } from '@/lib/types'
import { LimitPrompt } from '@/components/billing/LimitPrompt'

type Draft = { title: string; content_md: string; notice?: string; via?: 'ai' | 'text'; limit?: 'daily_limit' | 'fair_use' }

type Next = '' | 'summary' | 'cards' | 'quiz'
const NEXT: [Next, string][] = [['', 'Open the note'], ['summary', 'Open with Summary'], ['cards', 'Open with Flashcards'], ['quiz', 'Open with Quiz']]

type Picked = { file: File; kind: MaterialKind }

// Upload a PDF, Word, PowerPoint or text file or a photo, then either keep it in the Library as it is, or make a note from it
// (reviewed before saving; the original is kept beside it). Photos become notes through Scan, recordings through Lectures.
// keepOnly skips the question (the Library's Upload file); fromMaterial makes a note from a file the Library already keeps.
export function UploadDialog({ open, onClose, courses, onImported, onScan, keepOnly, fromMaterial, onKept }: {
  open: boolean; onClose: () => void; courses: Course[]; onImported?: (noteId: string) => void; onScan?: (files: File[]) => void
  keepOnly?: boolean; fromMaterial?: { id: string; file: File } | null; onKept?: () => void
}) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const { profile } = useProfile()
  const input = useRef<HTMLInputElement>(null)
  const [stage, setStage] = useState<'pick' | 'choose' | 'keep' | 'working' | 'review' | 'recording'>(fromMaterial ? 'choose' : 'pick')
  // the file chosen, before it is kept or read
  const [picked, setPicked] = useState<Picked | null>(() => (fromMaterial ? { file: fromMaterial.file, kind: kindOfMime(fromMaterial.file.type) } : null))
  const [next, setNext] = useState<Next>('')
  const [working, setWorking] = useState<{ label: string; steps?: string[] }>({ label: '' })
  const [draft, setDraft] = useState<Draft | null>(null)
  // the file the draft was read from, kept in the Library when the note is saved
  const [source, setSource] = useState<Picked | null>(null)
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
    setStage('pick'); setPicked(null); setDraft(null); setSource(null); setError(null); setCourseId(''); setNext('')
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
    if (kind === 'audio') { setStage('recording'); return }
    setPicked({ file, kind })
    setStage(keepOnly ? 'keep' : 'choose')
  }

  // Make a note from the chosen file: photos are read by Scan (with the photo), documents here
  function makeNote() {
    if (!picked) return
    if (picked.kind === 'image') { const f = picked.file; close(); (onScan ?? requestScan)([f]); return }
    void read(picked.file, picked.kind)
  }

  async function read(file: File, kind: Exclude<MaterialKind, 'image'>) {
    const gen = ++generation.current
    const controller = new AbortController()
    abort.current = controller
    setStage('working')
    try {
      let result: Draft
      if (kind === 'docx') {
        setWorking({ label: 'Reading your Word document' })
        const { docxToNote } = await import('@/lib/import/docxToNote')
        result = await docxToNote(await file.arrayBuffer(), file.name)
      } else if (kind === 'pptx') {
        setWorking({ label: 'Reading your slides' })
        const { pptxToNote } = await import('@/lib/import/pptxToNote')
        result = await pptxToNote(await file.arrayBuffer(), file.name)
      } else if (kind === 'text') {
        setWorking({ label: 'Reading your file' })
        const { textToNote } = await import('@/lib/import/textToNote')
        result = textToNote(await file.arrayBuffer(), file.name)
      } else {
        setWorking({ label: 'Reading your PDF with AI', steps: ['Finding the headings', 'Laying out lists and tables', 'Writing out the equations', 'Putting your note together'] })
        const { importPdf } = await import('@/lib/import/pdfImport')
        result = await importPdf(file, profile.id, controller.signal)
      }
      if (gen !== generation.current) return // cancelled meanwhile
      setDraft(result)
      setSource({ file, kind })
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
      // The original goes to the Library beside its note; the note is what matters, so a file that can't be kept only says so.
      // A file the Library already keeps is only pointed at its new note.
      if (fromMaterial && source?.file === fromMaterial.file) {
        await updateMaterial(supabase(), fromMaterial.id, { note_id: n.id }).catch(() => {})
      } else if (source) {
        await keepMaterial(supabase(), profile.id, source.file, source.kind, { course_id: courseId || null, note_id: n.id })
          .catch(() => toast('The note is saved, but the original file couldn\'t be kept in your Library.'))
      }
      onImported?.(n.id)
      close()
      router.push(`/notes/${n.id}${next ? `?study=${next}` : ''}`)
    } catch {
      toast('Couldn\'t save the note.')
    } finally {
      savingRef.current = false; setSaving(false)
    }
  }

  // Keep the chosen file in the Library as it is: no AI, no note
  async function keepFile() {
    if (!picked || savingRef.current) return
    savingRef.current = true; setSaving(true)
    try {
      const m = await keepMaterial(supabase(), profile.id, picked.file, picked.kind, { course_id: courseId || null, note_id: null })
      toast('Kept in your Library.')
      close()
      if (onKept) onKept()
      else if (await mayLeave()) router.push(`/files/${m.id}`)
    } catch {
      setError('Couldn\'t keep that file. Check your connection, or that it is under 25 MB.')
    } finally {
      savingRef.current = false; setSaving(false)
    }
  }

  const goToLectures = () => { void mayLeave().then(ok => { if (ok) { close(); router.push('/lectures') } }) }
  const chosenCourse = courses.find(c => c.id === courseId)
  const SUBTITLE = {
    pick: keepOnly ? 'Keep a file in your Library as it is.' : 'Keep a file in your Library, or turn it into a note you can study from.',
    choose: 'What should happen to it?',
    keep: 'It goes to your Library as it is. Nothing is read by AI.',
    working: 'Reading it…',
    review: fromMaterial ? 'Check it over, then save it as a note.' : 'Check it over, then save it as a note. The original file is kept in your Library.',
    recording: 'Audio and video go through Lectures.',
  }
  // the file chosen: its name and size, above the choice and the keep step
  const fileLine = picked && (
    <p className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm">
      <FileUp size={15} className="shrink-0 text-muted" aria-hidden /><span className="min-w-0 truncate font-medium">{picked.file.name}</span>
      <span className="ml-auto shrink-0 text-xs text-muted">{fileSize(picked.file.size)}</span>
    </p>
  )
  const option = 'flex w-full items-start gap-3 rounded-xl border border-line bg-raised p-3.5 text-left transition hover:bg-surface disabled:opacity-60'

  return (
    <Dialog open={open} onClose={close} title={keepOnly ? 'Upload file' : 'Upload material'} icon={FileUp} size="md" subtitle={SUBTITLE[stage]}>
      {stage === 'choose' && picked && (
        <div className="space-y-3">
          {fileLine}
          <button type="button" className={option} onClick={makeNote}>
            <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"><Sparkles size={17} /></span>
            <span><span className="block text-sm font-medium">{fromMaterial ? 'Make a note from it' : 'Make a note'}</span>
              <span className="block text-xs text-muted">{picked.kind === 'image' ? 'Scan reads the photo with AI, which uses an AI action.'
                : picked.kind === 'pdf' ? 'AI reads the PDF into headings, lists and tables, which uses AI actions. You check it before saving.'
                : 'It is read here for free. You check it before saving.'}{fromMaterial || picked.kind === 'image' ? '' : ' The file is kept too.'}</span></span>
          </button>
          {!fromMaterial && (
            <button type="button" className={option} onClick={() => setStage('keep')}>
              <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface text-muted"><FolderOpen size={17} /></span>
              <span><span className="block text-sm font-medium">Just keep the file</span><span className="block text-xs text-muted">Save it to your Library as it is. No AI. You can make a note from it later.</span></span>
            </button>
          )}
          {!fromMaterial && <DialogFooter><button type="button" className={BTN_OUTLINE} onClick={reset}>Choose another</button></DialogFooter>}
        </div>
      )}
      {stage === 'keep' && picked && (
        <div className="space-y-4">
          {fileLine}
          <div className="space-y-1.5">
            <p className="text-sm">Course</p>
            <ChoiceChips label="Course" size="sm" value={courseId} onChange={setCourseId} options={[{ value: '', label: 'No course' }, ...courses.map(c => ({ value: c.id, label: c.name }))]} />
          </div>
          {error && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <DialogFooter note={chosenCourse ? `In ${chosenCourse.name}` : undefined}>
            <button type="button" className={BTN_OUTLINE} onClick={keepOnly ? reset : () => { setError(null); setStage('choose') }}>{keepOnly ? 'Choose another' : 'Back'}</button>
            <button type="button" className={BTN_SOLID} onClick={() => { void keepFile() }} disabled={saving}>{saving ? 'Keeping…' : 'Keep file'}</button>
          </DialogFooter>
        </div>
      )}
      {stage === 'pick' && (
        <div className="space-y-4">
          <DropZone label="Drop a file here" onFiles={f => void pick(f[0])} className="px-5 py-8 text-center">
            <span aria-hidden className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent"><UploadCloud size={24} /></span>
            <p className="mt-3 text-base font-medium">Drop a file here</p>
            <p className="mb-3 text-sm text-muted">or</p>
            <button type="button" className={BTN_SOLID} onClick={() => input.current?.click()}>Choose a file</button>
            <ul className="mt-4 flex flex-wrap justify-center gap-1.5" aria-label="Accepted files">
              {['PDF', 'Word', 'PowerPoint', 'Text', 'Photo'].map(t => <li key={t} className="rounded-md bg-raised px-2 py-0.5 text-xs text-muted ring-1 ring-line">{t}</li>)}
            </ul>
          </DropZone>
          <input ref={input} type="file" accept=".pdf,.docx,.pptx,.txt,.md,.markdown,.jpg,.jpeg,.png,.webp,.mp3,.m4a,.wav,.webm,.ogg,.mp4,.mov,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/markdown,image/*,audio/*,video/*"
            className="sr-only" aria-label="File to upload" onChange={e => { const f = e.target.files?.[0]; if (f) void pick(f) }} />
          {error && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          {!keepOnly && <p className="flex items-start gap-2 text-xs text-muted"><Sparkles size={13} className="mt-0.5 shrink-0 text-accent" aria-hidden />
            <span>After choosing, you can keep the file as it is, or make a note from it. PDFs are read by AI (OpenAI), which uses AI actions, up to 24 MB and 100 pages. Word, PowerPoint and text files are read here for free.</span></p>}
          {!keepOnly && <div>
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
          </div>}
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
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface px-4 py-10 text-center">
          <Working kind="read" label={working.label} steps={working.steps} />
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
