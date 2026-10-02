'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Printer } from 'lucide-react'
import { MarkdownView } from '@/components/notes/MarkdownView'
import { supabase } from '@/lib/supabase/client'
import { getNotesForExport } from '@/lib/data/notes'
import { listCourses } from '@/lib/data/courses'
import type { Course, Note } from '@/lib/types'

// Print-ready copy of one, some, or all notes. The browser's print dialog saves it as a PDF,
// keeping KaTeX math crisp and the text selectable.
function PrintNotes() {
  const ids = useSearchParams().get('ids')
  const [notes, setNotes] = useState<Note[] | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const sb = supabase()
    Promise.all([getNotesForExport(sb, ids ? ids.split(',').filter(Boolean) : undefined), listCourses(sb)])
      .then(([n, c]) => { setNotes(n); setCourses(c) })
      .catch(() => setFailed(true))
  }, [ids])

  useEffect(() => {
    if (!notes?.length) return
    document.title = notes.length === 1 ? notes[0].title : 'Studyhub notes'
    // Wait for fonts so the PDF doesn't capture fallback glyphs
    const t = setTimeout(() => { void document.fonts.ready.then(() => window.print()) }, 400)
    return () => clearTimeout(t)
  }, [notes])

  if (failed) return <p className="p-8 text-sm text-muted">Couldn&apos;t load these notes. Go back to Notes and try exporting again.</p>
  if (!notes) return <p className="p-8 text-sm text-muted">Preparing…</p>
  if (!notes.length) return <p className="p-8 text-sm text-muted">There are no notes to export.</p>

  return (
    <div className="mx-auto max-w-3xl px-8 py-10 text-[15px]">
      <div className="no-print mb-8 flex items-center justify-between rounded-xl border border-line bg-raised px-4 py-3 text-sm">
        <span className="text-muted">In the print dialog, choose <b>Save as PDF</b>.</span>
        <button className="btn-primary" onClick={() => window.print()}><Printer size={14} aria-hidden />Print or save</button>
      </div>
      {notes.map(n => (
        <article key={n.id} className="print-note mb-12">
          <h1 className="text-3xl font-semibold">{n.title || 'Untitled'}</h1>
          {courses.find(c => c.id === n.course_id) && (
            <p className="mb-6 mt-1 text-sm italic text-muted">{courses.find(c => c.id === n.course_id)!.name}</p>
          )}
          <MarkdownView source={n.content_md} />
        </article>
      ))}
    </div>
  )
}

export default function PrintNotesPage() {
  return <Suspense><PrintNotes /></Suspense>
}
