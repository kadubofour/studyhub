import type { Notebook, NoteSummary } from '@/lib/types'
import { notebookCourse } from '@/lib/notes/notebooks'

/** The page of the course something is in: its own, or the one for material in no course */
export const courseHref = (courseId: string | null | undefined) => (courseId ? `/courses/${courseId}` : '/courses/none')

/** Where a notebook's back button goes: the page of the course it is in (the one chosen for it, else the one its notes share) */
export const notebookHomeHref = (book: Notebook, notes: Pick<NoteSummary, 'notebook_id' | 'course_id'>[]) => courseHref(notebookCourse(book, notes))
