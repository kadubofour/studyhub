import { describe, it, expect } from 'vitest'
import { countsByCourse, countsByKind, folders, isMovable, visible, withKnownNotebooks, type LibraryItem, type View } from '@/lib/library/items'

const item = (kind: LibraryItem['kind'], id: string, title: string, course: string | null, at: string): LibraryItem =>
  ({ kind, id, title, course_id: course, at, meta: '', href: `/${kind}/${id}` })
const ALL = [
  item('note', 'n1', 'Krebs cycle', 'bio', '2026-10-10T10:00:00Z'),
  item('note', 'n2', 'Glycolysis', 'bio', '2026-10-12T10:00:00Z'),
  item('note', 'n3', 'Loose thoughts', null, '2026-10-11T10:00:00Z'),
  item('deck', 'd1', 'Cells', 'bio', '2026-10-09T10:00:00Z'),
  item('deck', 'd2', 'Spanish verbs', 'lang', '2026-10-08T10:00:00Z'),
  item('lecture', 'l1', 'Week 3 lecture', 'bio', '2026-10-07T10:00:00Z'),
  item('quiz', 'q1', 'Krebs quiz', 'bio', '2026-10-10T12:00:00Z'),
  item('chat', 'c1', 'Why is it in the matrix?', null, '2026-10-06T10:00:00Z'),
]
const view = (over: Partial<View> = {}): View => ({ course: 'all', kind: null, q: '', sort: 'recent', ...over })
const ids = (items: LibraryItem[]) => items.map(i => i.id)

describe('visible', () => {
  it('shows everything, newest first, by default', () => {
    expect(ids(visible(ALL, view()))).toEqual(['n2', 'n3', 'q1', 'n1', 'd1', 'd2', 'l1', 'c1'])
  })
  it('shows one course, or only what has none', () => {
    expect(ids(visible(ALL, view({ course: 'lang' })))).toEqual(['d2'])
    expect(ids(visible(ALL, view({ course: 'none' })))).toEqual(['n3', 'c1'])
  })
  it('shows one kind of thing', () => {
    expect(ids(visible(ALL, view({ kind: 'deck' })))).toEqual(['d1', 'd2'])
  })
  it('searches titles, ignoring case and spaces at the ends', () => {
    expect(ids(visible(ALL, view({ q: '  KREBS ' })))).toEqual(['q1', 'n1'])
    expect(ids(visible(ALL, view({ q: 'nothing like this' })))).toEqual([])
  })
  it('combines the filters', () => {
    expect(ids(visible(ALL, view({ course: 'bio', kind: 'note', q: 'gly' })))).toEqual(['n2'])
  })
  it('can sort by name, ignoring case', () => {
    const named = [item('note', 'a', 'banana', null, '2026-01-01T00:00:00Z'), item('note', 'b', 'Apple', null, '2026-01-02T00:00:00Z'), item('note', 'c', 'cherry', null, '2026-01-03T00:00:00Z')]
    expect(ids(visible(named, view({ sort: 'name' })))).toEqual(['b', 'a', 'c'])
  })
  it('does not change the list it was given', () => {
    const copy = [...ALL]
    visible(ALL, view({ sort: 'name' }))
    expect(ALL).toEqual(copy)
  })
})

describe('counts', () => {
  it('count each kind for the chosen course and search, whatever kind is chosen, so a chip says what a click would show', () => {
    expect(countsByKind(ALL, view({ course: 'bio' }))).toEqual({ note: 2, deck: 1, lecture: 1, quiz: 1, chat: 0 })
    expect(countsByKind(ALL, view({ course: 'bio', kind: 'deck' }))).toEqual({ note: 2, deck: 1, lecture: 1, quiz: 1, chat: 0 })
    expect(countsByKind(ALL, view({ q: 'krebs' }))).toEqual({ note: 1, deck: 0, lecture: 0, quiz: 1, chat: 0 })
  })
  it('count each course, with what has none, ignoring the kind and search', () => {
    expect(countsByCourse(ALL)).toEqual({ all: 8, none: 2, byId: { bio: 5, lang: 1 } })
  })
})

describe('isMovable', () => {
  it('is true for everything but quizzes, which follow their note', () => {
    expect(ALL.filter(isMovable).map(i => i.kind)).not.toContain('quiz')
    expect(ALL.filter(isMovable)).toHaveLength(7)
  })
})

describe('notebooks are folders', () => {
  const inBook = (i: LibraryItem, notebook_id: string | null): LibraryItem => ({ ...i, notebook_id })
  const FILED = [
    inBook(item('note', 'n1', 'Krebs cycle', 'bio', '2026-10-10T10:00:00Z'), 'cell'),
    inBook(item('note', 'n2', 'Glycolysis', 'bio', '2026-10-12T10:00:00Z'), 'cell'),
    inBook(item('note', 'n3', 'Loose thoughts', null, '2026-10-11T10:00:00Z'), null),
    inBook(item('note', 'n4', 'Verbs list', 'lang', '2026-10-05T10:00:00Z'), 'span'),
    item('deck', 'd1', 'Cells', 'bio', '2026-10-09T10:00:00Z'),
  ]
  const BOOKS = [{ id: 'span', name: 'Spanish', created_at: '' }, { id: 'cell', name: 'Cell biology', created_at: '' }, { id: 'empty', name: 'Empty one', created_at: '' }]
  it('while browsing, a note in a notebook is inside its folder, not loose', () => {
    expect(ids(visible(FILED, view()))).toEqual(['n3', 'd1'])
  })
  it('an open folder shows its notes, and only those, in the chosen order and course', () => {
    expect(ids(visible(FILED, view({ folder: 'cell' })))).toEqual(['n2', 'n1'])
    expect(ids(visible(FILED, view({ folder: 'cell', sort: 'name' })))).toEqual(['n2', 'n1'])
    expect(ids(visible(FILED, view({ folder: 'cell', q: 'krebs' })))).toEqual(['n1'])
    expect(ids(visible(FILED, view({ folder: 'cell', course: 'lang' })))).toEqual([])
  })
  it('searching or choosing a kind looks inside every folder', () => {
    expect(ids(visible(FILED, view({ q: 'krebs' })))).toEqual(['n1'])
    expect(ids(visible(FILED, view({ kind: 'note' })))).toEqual(['n2', 'n3', 'n1', 'n4'])
  })
  it('lists the folders by name with how many notes each holds in the course shown; an empty one only under All', () => {
    expect(folders(FILED, BOOKS, view())).toEqual([
      { notebook: BOOKS[1], count: 2 }, { notebook: BOOKS[2], count: 0 }, { notebook: BOOKS[0], count: 1 },
    ])
    expect(folders(FILED, BOOKS, view({ course: 'bio' }))).toEqual([{ notebook: BOOKS[1], count: 2 }])
    expect(folders(FILED, BOOKS, view({ course: 'none' }))).toEqual([])
  })
  it('shows no folders while finding things, or inside a folder', () => {
    expect(folders(FILED, BOOKS, view({ q: 'krebs' }))).toEqual([])
    expect(folders(FILED, BOOKS, view({ kind: 'deck' }))).toEqual([])
    expect(folders(FILED, BOOKS, view({ folder: 'cell' }))).toEqual([])
  })
})

describe('withKnownNotebooks', () => {
  it('treats a note whose notebook is not in the list as loose, so it never disappears', () => {
    const notes = [{ ...item('note', 'a', 'A', null, ''), notebook_id: 'gone' }, { ...item('note', 'b', 'B', null, ''), notebook_id: 'kept' }, item('deck', 'd', 'D', null, '')]
    const out = withKnownNotebooks(notes, [{ id: 'kept', name: 'Kept', created_at: '' }])
    expect(out.map(i => i.notebook_id ?? null)).toEqual([null, 'kept', null])
  })
})
