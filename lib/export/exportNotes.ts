import { supabase } from '@/lib/supabase/client'
import { getNotesForExport } from '@/lib/data/notes'
import { listCourses } from '@/lib/data/courses'

const fileSafe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80) || 'Notes'

/** Download notes (some ids, or all when omitted) as a Word document. False when there was nothing to export. */
export async function exportNotesToWord(ids?: string[], fileName?: string): Promise<boolean> {
  const sb = supabase()
  const [notes, courses] = await Promise.all([getNotesForExport(sb, ids), listCourses(sb)])
  if (!notes.length) return false
  const { notesToDocx } = await import('@/lib/export/notesToDocx')
  const blob = await notesToDocx(notes.map(n => ({
    title: n.title, content_md: n.content_md, course: courses.find(c => c.id === n.course_id)?.name ?? null,
  })))
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${fileSafe(fileName ?? (notes.length === 1 ? notes[0].title : 'Studyhub notes'))}.docx`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
  return true
}

/** PDF opens a print-ready page where the browser's "Save as PDF" keeps math crisp and text selectable. */
export function openPdfExport(ids?: string[]) {
  window.open(`/print/notes${ids ? `?ids=${ids.join(',')}` : ''}`, '_blank', 'noopener')
}
