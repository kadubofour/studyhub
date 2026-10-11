'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileUp, Sparkles, Loader2 } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { MarkdownView } from '@/components/notes/MarkdownView'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { createNote } from '@/lib/data/notes'
import { fileKind } from '@/lib/import/fileKind'
import type { Course } from '@/lib/types'
import { LimitPrompt } from '@/components/billing/LimitPrompt'

type Draft = { title: string; content_md: string; notice?: string; via?: 'ai' | 'text'; limit?: 'daily_limit' | 'fair_use' }

type Next = '' | 'summary' | 'cards' | 'quiz'
const NEXT: [Next, string][] = [['', 'Open the note'], ['summary', 'Open with Summary'], ['cards', 'Open with Flashcards'], ['quiz', 'Open with Quiz']]

// Upload a PDF, Word, PowerPoint or text file and review it before it becomes a note. Photos go to Scan, recordings to Lectures.
export function UploadDialog({ open, onClose, courses, onImported, onScan }: {
  open: boolean; onClose: () => void; courses: Course[]; onImported?: () => void; onScan?: () => void
}) {
  const router = useRouter()
  const toast = useToast()
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
    if (!kind) { setError('Choose a PDF, Word, PowerPoint or text file.'); return }
    if (kind === 'image' && onScan) { close(); onScan(); return } // photos are read by Scan
    if (kind === 'image') { setError('Photos are read by Scan. Open Scan from the sidebar.'); return }
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

  async function save() {
    if (!draft || savingRef.current) return
    savingRef.current = true; setSaving(true)
    try {
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

  return (
    <Dialog open={open} onClose={close} title="Upload material">
      {stage === 'pick' && (
        <div className="space-y-3">
          <button type="button" onClick={() => input.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line px-4 py-8 text-center transition hover:border-accent hover:bg-accent-soft">
            <FileUp size={26} className="text-accent" aria-hidden />
            <span className="font-medium">Choose a file</span>
            <span className="text-xs text-muted">PDF, Word, PowerPoint or a text file. PDFs are structured by AI (OpenAI), which uses AI actions: headings, lists, tables and equations, up to 24 MB and 100 pages. The others are read here for free.</span>
          </button>
          <input ref={input} type="file" accept=".pdf,.docx,.pptx,.txt,.md,.markdown,.jpg,.jpeg,.png,.webp,.mp3,.m4a,.wav,.webm,.ogg,.mp4,.mov,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/markdown,image/*,audio/*,video/*"
            className="sr-only" aria-label="File to upload" onChange={e => { const f = e.target.files?.[0]; if (f) void pick(f) }} />
          <p className="text-xs text-muted">Photos of notes or slides go through Scan. Recordings are recorded or uploaded in Lectures.</p>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end"><button type="button" className="btn" onClick={close}>Cancel</button></div>
        </div>
      )}
      {stage === 'recording' && (
        <div className="space-y-3">
          <p className="text-sm">Audio and video are recorded or uploaded in Lectures, where they are transcribed and can become a note.</p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={reset}>Choose another</button>
            <button type="button" className="btn-primary" onClick={() => { close(); router.push('/lectures') }}>Go to Lectures</button>
          </div>
        </div>
      )}
      {stage === 'working' && (
        <div className="flex flex-col items-center gap-3 py-8 text-center" role="status">
          <Loader2 size={26} className="animate-spin text-accent" aria-hidden />
          <p className="text-sm text-muted">{working}</p>
          <button type="button" className="btn mt-2" onClick={reset}>Cancel upload</button>
        </div>
      )}
      {stage === 'review' && draft && (
        <div className="space-y-3">
          {draft.via === 'ai' && <p className="flex items-center gap-1.5 text-xs text-accent"><Sparkles size={13} aria-hidden />Structured by AI — check it before saving.</p>}
          {draft.limit
            ? <LimitPrompt kind={draft.limit} title={draft.notice} />
            : draft.notice && <p className="rounded-lg bg-accent-soft px-3 py-2 text-xs">{draft.notice}</p>}
          <label className="field"><span>Title</span><input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
          <label className="field"><span>Course</span>
            <select value={courseId} onChange={e => setCourseId(e.target.value)}>
              <option value="">No course</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <fieldset className="field">
            <legend className="text-sm">After saving</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {NEXT.map(([v, label]) => (
                <label key={v} className="flex items-center gap-1.5 text-sm"><input type="radio" name="after-save" checked={next === v} onChange={() => setNext(v)} />{label}</label>
              ))}
            </div>
          </fieldset>
          <div className="max-h-64 overflow-y-auto rounded-xl border border-line px-3 py-2" aria-label="Preview">
            <MarkdownView source={draft.content_md || '*This file had no text.*'} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={reset}>Choose another</button>
            <button type="button" className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save note'}</button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
