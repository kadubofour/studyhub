'use client'
import { useEffect, useRef, useState } from 'react'
import { Download, FileText, FileType2 } from 'lucide-react'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { getNotesForExport } from '@/lib/data/notes'
import { listCourses } from '@/lib/data/courses'

const fileSafe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80) || 'Notes'

/**
 * Export one note, a selection, or everything (ids omitted) as a Word document or PDF.
 * PDF opens a print-ready page where the browser's "Save as PDF" keeps math crisp and text selectable.
 */
export function ExportMenu({ ids, label = 'Export', fileName, disabled }: {
  ids?: string[]; label?: string; fileName?: string; disabled?: boolean
}) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc, true)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc, true) }
  }, [open])

  async function toWord() {
    setOpen(false); setBusy(true)
    try {
      const sb = supabase()
      const [notes, courses] = await Promise.all([getNotesForExport(sb, ids), listCourses(sb)])
      if (!notes.length) { toast('There are no notes to export.'); return }
      const { notesToDocx } = await import('@/lib/export/notesToDocx')
      const blob = await notesToDocx(notes.map(n => ({
        title: n.title, content_md: n.content_md, course: courses.find(c => c.id === n.course_id)?.name ?? null,
      })))
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${fileSafe(fileName ?? (notes.length === 1 ? notes[0].title : 'Studyhub notes'))}.docx`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
    } catch {
      toast('Couldn\'t create the Word document.')
    } finally { setBusy(false) }
  }

  function toPdf() {
    setOpen(false)
    window.open(`/print/notes${ids ? `?ids=${ids.join(',')}` : ''}`, '_blank', 'noopener')
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" className="btn" onClick={() => setOpen(o => !o)} disabled={disabled || busy} aria-haspopup="menu" aria-expanded={open}>
        <Download size={14} aria-hidden />{busy ? 'Preparing…' : label}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-1 w-56 rounded-xl border border-line bg-raised p-1 shadow-lg">
          <button role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-surface" onClick={toWord}>
            <FileText size={15} className="text-[#2B579A]" aria-hidden />Word document (.docx)
          </button>
          <button role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-surface" onClick={toPdf}>
            <FileType2 size={15} className="text-danger" aria-hidden />PDF
          </button>
        </div>
      )}
    </div>
  )
}
