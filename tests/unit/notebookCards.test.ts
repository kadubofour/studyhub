import { describe, expect, it } from 'vitest'
import { contents, notebookCards } from '@/lib/library/notebookCards'
import type { Kind, LibraryItem } from '@/lib/library/items'
import type { Notebook } from '@/lib/types'

const now = new Date('2030-05-10T12:00:00Z')
const HOUR = 3_600_000, DAY = 24 * HOUR
const iso = (msAgo: number) => new Date(now.getTime() - msAgo).toISOString()

const book = (id: string, name: string, extra: Partial<Notebook> = {}): Notebook => ({ id, name, created_at: iso(100 * DAY), ...extra })
const item = (kind: Kind, id: string, notebook: string | null, at: string): LibraryItem => ({ kind, id, title: id, course_id: null, notebook_id: notebook, at, meta: '', href: `/x/${id}` })
const bio = book('b', 'Biology'), chem = book('c', 'Chemistry'), art = book('a', 'Art history'), general = book('g', 'General', { is_default: true })
const items = [
  item('note', 'n1', 'b', iso(10 * HOUR)), item('note', 'n2', 'b', iso(2 * DAY)), item('deck', 'd1', 'b', iso(5 * DAY)), item('file', 'f1', 'b', iso(DAY)),
  item('lecture', 'l1', 'c', iso(HOUR)), item('quiz', 'q1', 'c', iso(3 * HOUR)), item('chat', 'chat', null, iso(1000)),
]
const base = { notebooks: [bio, chem, art, general], items, courses: [], q: '', sort: 'recent' as const }

describe('notebookCards', () => {
  it('counts what is in each notebook by kind, and when anything in it last changed', () => {
    const b = notebookCards(base).find(c => c.notebook.id === 'b')!
    expect(b.counts).toEqual({ note: 2, deck: 1, lecture: 0, file: 1, quiz: 0 })
    expect(b.total).toBe(4)
    expect(b.lastAt).toBe(iso(10 * HOUR))
  })
  it('says what is in a notebook in words, or that it is empty', () => {
    const cards = notebookCards(base)
    expect(contents(cards.find(c => c.notebook.id === 'b')!)).toBe('2 notes · 1 deck · 1 material')
    expect(contents(cards.find(c => c.notebook.id === 'c')!)).toBe('1 lecture · 1 quiz')
    expect(contents(cards.find(c => c.notebook.id === 'a')!)).toBe('Empty')
  })
  it('orders by last changed, name or what is in them; an empty notebook comes after the rest by when it was made', () => {
    expect(notebookCards(base).map(c => c.notebook.id).slice(0, 2)).toEqual(['c', 'b'])
    expect(notebookCards({ ...base, sort: 'name' }).map(c => c.notebook.id)).toEqual(['a', 'b', 'c', 'g'])
    expect(notebookCards({ ...base, sort: 'size' }).map(c => c.notebook.id).slice(0, 2)).toEqual(['b', 'c'])
  })
  it('searches notebook names, ignoring case', () => {
    expect(notebookCards({ ...base, q: ' CHEM ' }).map(c => c.notebook.id)).toEqual(['c'])
    expect(notebookCards({ ...base, q: 'zzz' })).toEqual([])
  })
  it('ignores a tutor chat, which is in no notebook', () => {
    expect(notebookCards(base).reduce((n, c) => n + c.total, 0)).toBe(6)
  })
})
