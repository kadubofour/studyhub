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

// Import a Word document or a PDF (structured by Claude) and review it before it becomes a note
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

  function reset() { setStage('pick'); setDraft(null); setError(null); setCourseId(''); if (input.current) input.current.value = '' }
  function close() { reset(); onClose() }

  async function pick(file: File) {
    setError(null)
    const name = file.name.toLowerCase()
    try {
      if (name.endsWith('.docx')) {
        setStage('working'); setWorking('Reading your Word document…')
        const { docxToNote } = await import('@/lib/import/docxToNote')
        setDraft(await docxToNote(await file.arrayBuffer(), file.name))
      } else if (name.endsWith('.pdf')) {
        setStage('working'); setWorking('Reading your PDF with AI — headings, lists, tables and equations…')
        const { importPdf } = await import('@/lib/import/pdfImport')
        setDraft(await importPdf(file, profile.id))
      } else {
        setError('Choose a Word document (.docx) or a PDF.'); return
      }
      setStage('review')
    } catch (e) {
      setStage('pick')
      setError(e instanceof Error && e.message.includes('32 MB') ? e.message : 'Couldn\'t read that file. Try another one.')
    }
  }

  async function save() {
    if (!draft) return
    try {
      const n = await createNote(supabase(), { title: draft.title.trim() || 'Imported note', content_md: draft.content_md, course_id: courseId || null })
      onImported?.()
      close()
      router.push(`/notes/${n.id}`)
    } catch { toast('Couldn\'t save the note.') }
  }

  return (
    <Dialog open={open} onClose={close} title="Import a note">
      {stage === 'pick' && (
        <div className="space-y-3">
          <button type="button" onClick={() => input.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line px-4 py-8 text-center transition hover:border-accent hover:bg-accent-soft">
            <FileUp size={26} className="text-accent" aria-hidden />
            <span className="font-medium">Choose a Word document or PDF</span>
            <span className="text-xs text-muted">PDFs are structured by Claude (Anthropic) — headings, lists, tables and equations.</span>
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
            <button type="button" className="btn-primary" onClick={save}>Save note</button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
