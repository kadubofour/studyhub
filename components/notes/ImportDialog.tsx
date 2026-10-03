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
import type { Course } from '@/lib/types'

type Draft = { title: string; content_md: string; notice?: string; via?: 'ai' | 'text' }

// Import a Word document or a PDF (structured by AI) and review it before it becomes a note
export function ImportDialog({ open, onClose, courses, onImported }: {
  open: boolean; onClose: () => void; courses: Course[]; onImported?: () => void
}) {
  const router = useRouter()
  const toast = useToast()
  const { profile } = useProfile()
  const input = useRef<HTMLInputElement>(null)
  const [stage, setStage] = useState<'pick' | 'working' | 'review'>('pick')
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
    setStage('pick'); setDraft(null); setError(null); setCourseId('')
    if (input.current) input.current.value = ''
  }
  function close() { reset(); onClose() }

  async function pick(file: File) {
    setError(null)
    const name = file.name.toLowerCase()
    if (!name.endsWith('.docx') && !name.endsWith('.pdf')) { setError('Choose a Word document (.docx) or a PDF.'); return }
    const gen = ++generation.current
    const controller = new AbortController()
    abort.current = controller
    setStage('working')
    try {
      let result: Draft
      if (name.endsWith('.docx')) {
        setWorking('Reading your Word document…')
        const { docxToNote } = await import('@/lib/import/docxToNote')
        result = await docxToNote(await file.arrayBuffer(), file.name)
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
      router.push(`/notes/${n.id}`)
    } catch {
      toast('Couldn\'t save the note.')
    } finally {
      savingRef.current = false; setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={close} title="Import a note">
      {stage === 'pick' && (
        <div className="space-y-3">
          <button type="button" onClick={() => input.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line px-4 py-8 text-center transition hover:border-accent hover:bg-accent-soft">
            <FileUp size={26} className="text-accent" aria-hidden />
            <span className="font-medium">Choose a Word document or PDF</span>
            <span className="text-xs text-muted">PDFs are structured by AI (OpenAI): headings, lists, tables and equations. Up to 24 MB and 100 pages.</span>
          </button>
          <input ref={input} type="file" accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="sr-only" aria-label="File to import" onChange={e => { const f = e.target.files?.[0]; if (f) void pick(f) }} />
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end"><button type="button" className="btn" onClick={close}>Cancel</button></div>
        </div>
      )}
      {stage === 'working' && (
        <div className="flex flex-col items-center gap-3 py-8 text-center" role="status">
          <Loader2 size={26} className="animate-spin text-accent" aria-hidden />
          <p className="text-sm text-muted">{working}</p>
          <button type="button" className="btn mt-2" onClick={reset}>Cancel import</button>
        </div>
      )}
      {stage === 'review' && draft && (
        <div className="space-y-3">
          {draft.via === 'ai' && <p className="flex items-center gap-1.5 text-xs text-accent"><Sparkles size={13} aria-hidden />Structured by AI — check it before saving.</p>}
          {draft.notice && <p className="rounded-lg bg-accent-soft px-3 py-2 text-xs">{draft.notice}</p>}
          <label className="field"><span>Title</span><input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
          <label className="field"><span>Course</span>
            <select value={courseId} onChange={e => setCourseId(e.target.value)}>
              <option value="">No course</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
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
