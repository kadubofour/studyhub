import { describe, it, expect } from 'vitest'
import { notebookColor, notebookCourse } from '@/lib/notes/notebooks'

const courses = [{ id: 'bio', name: 'Biology', color: '#1D9E75' }, { id: 'chem', name: 'Chemistry', color: '#BA7517' }]
const note = (course_id: string | null, notebook_id = 'nb') => ({ id: Math.random().toString(), title: '', updated_at: '', course_id, notebook_id })

describe('a notebook\'s course and colour', () => {
  it('is the course chosen for it', () => {
    expect(notebookCourse({ id: 'nb', name: 'x', course_id: 'chem' }, [note('bio')])).toBe('chem')
  })
  it('otherwise the course its notes share, ignoring notes with none and notes in other notebooks', () => {
    expect(notebookCourse({ id: 'nb', name: 'x' }, [note('bio'), note(null), note('bio'), note('chem', 'other')])).toBe('bio')
  })
  it('otherwise none: mixed courses, or no notes', () => {
    expect(notebookCourse({ id: 'nb', name: 'x' }, [note('bio'), note('chem')])).toBeNull()
    expect(notebookCourse({ id: 'nb', name: 'x' }, [])).toBeNull()
  })
  it('is coloured by its course, or the accent when it has none (or the course is gone)', () => {
    expect(notebookColor({ id: 'nb', name: 'x', course_id: 'bio' }, [], courses)).toBe('#1D9E75')
    expect(notebookColor({ id: 'nb', name: 'x' }, [], courses)).toBe('var(--accent-solid)')
    expect(notebookColor({ id: 'nb', name: 'x', course_id: 'deleted' }, [], courses)).toBe('var(--accent-solid)')
  })
})
