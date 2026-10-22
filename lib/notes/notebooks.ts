import type { NoteSummary } from '../types'

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
