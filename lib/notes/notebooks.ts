import type { Course, Notebook, NoteSummary } from '../types'

/** The notes to show: for a notebook chosen ('' is all, 'none' the unfiled ones, otherwise a notebook's id), and a course ('' is all) */
export function filterNotes(notes: NoteSummary[], { notebook, course }: { notebook: string; course: string }): NoteSummary[] {
  return notes.filter(n => {
    if (course && n.course_id !== course) return false
    if (notebook === 'none') return !n.notebook_id
    if (notebook) return n.notebook_id === notebook
    return true
  })
}

/** How many notes are in each notebook, how many are in none, and how many there are */
export function countByNotebook(notes: NoteSummary[]): { byId: Record<string, number>; unfiled: number; all: number } {
  const byId: Record<string, number> = {}
  let unfiled = 0
  for (const n of notes) { if (n.notebook_id) byId[n.notebook_id] = (byId[n.notebook_id] ?? 0) + 1; else unfiled++ }
  return { byId, unfiled, all: notes.length }
}

/** The course a notebook belongs to: the one chosen for it, else the one all its notes share (notes with no course aside), else none */
export function notebookCourse(book: Notebook, notes: Pick<NoteSummary, 'notebook_id' | 'course_id'>[]): string | null {
  if (book.course_id) return book.course_id
  const inside = new Set(notes.filter(n => n.notebook_id === book.id && n.course_id).map(n => n.course_id))
  return inside.size === 1 ? [...inside][0]! : null
}

/** Its cover colour: its course's, or the student's accent when it has none */
export function notebookColor(book: Notebook, notes: Pick<NoteSummary, 'notebook_id' | 'course_id'>[], courses: Pick<Course, 'id' | 'color'>[]): string {
  const id = notebookCourse(book, notes)
  return courses.find(c => c.id === id)?.color ?? 'var(--accent-solid)'
}
