import { describe, it, expect } from 'vitest'
import { countByNotebook, filterNotes } from '@/lib/notes/notebooks'
import type { NoteSummary } from '@/lib/types'

const n = (id: string, over: Partial<NoteSummary> = {}): NoteSummary => ({ id, course_id: null, title: id, updated_at: '2026-10-01T00:00:00Z', notebook_id: null, ...over })
const notes = [n('a', { notebook_id: 'b1', course_id: 'c1' }), n('b', { notebook_id: 'b1', course_id: 'c2' }), n('c', { notebook_id: 'b2' }), n('d'), n('e', { notebook_id: undefined })]

describe('filterNotes', () => {
  it('shows everything for All, a notebook\'s notes, or the unfiled ones', () => {
    expect(filterNotes(notes, { notebook: '', course: '' }).map(x => x.id)).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(filterNotes(notes, { notebook: 'b1', course: '' }).map(x => x.id)).toEqual(['a', 'b'])
    expect(filterNotes(notes, { notebook: 'none', course: '' }).map(x => x.id)).toEqual(['d', 'e']) // missing counts as unfiled
  })
  it('also filters by course, together with the notebook', () => {
    expect(filterNotes(notes, { notebook: 'b1', course: 'c2' }).map(x => x.id)).toEqual(['b'])
    expect(filterNotes(notes, { notebook: '', course: 'c1' }).map(x => x.id)).toEqual(['a'])
  })
})

describe('countByNotebook', () => {
  it('counts the notes in each notebook and the unfiled ones', () => {
    expect(countByNotebook(notes)).toEqual({ byId: { b1: 2, b2: 1 }, unfiled: 2, all: 5 })
    expect(countByNotebook([])).toEqual({ byId: {}, unfiled: 0, all: 0 })
  })
})
