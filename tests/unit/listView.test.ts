// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { VIEW_CHOICES, parseView, sortDecks, sortLectures, sortNotes, viewStore } from '@/lib/ui/listView'

beforeEach(() => localStorage.clear())

describe('parseView', () => {
  it('keeps a known layout and sort, and falls back to the page\'s defaults otherwise', () => {
    expect(parseView('notes', { layout: 'list', sort: 'title' })).toEqual({ layout: 'list', sort: 'title' })
    expect(parseView('notes', { layout: 'tiles', sort: 'nonsense' })).toEqual({ layout: 'grid', sort: 'edited' })
    expect(parseView('lectures', null)).toEqual({ layout: 'list', sort: 'newest' })
    expect(parseView('decks', { sort: 'due' })).toEqual({ layout: 'grid', sort: 'due' })
  })
  it('each page offers its own sorts', () => {
    expect(VIEW_CHOICES.notes.sorts.map(s => s.label)).toEqual(['Recently edited', 'Title (A to Z)', 'Course'])
    expect(VIEW_CHOICES.decks.sorts.map(s => s.label)).toEqual(['Most due', 'Name (A to Z)', 'Newest'])
    expect(VIEW_CHOICES.lectures.sorts.map(s => s.label)).toEqual(['Newest', 'Oldest', 'Title (A to Z)'])
  })
})

describe('viewStore', () => {
  it('remembers each page\'s choice on its own', () => {
    viewStore('notes').set({ layout: 'list', sort: 'title' })
    expect(viewStore('notes').get()).toEqual({ layout: 'list', sort: 'title' })
    expect(viewStore('decks').get()).toEqual({ layout: 'grid', sort: 'due' })
  })
})

describe('sorts', () => {
  const note = (id: string, title: string, updated_at: string, course_id: string | null = null) => ({ id, title, updated_at, course_id })
  it('notes: recently edited, by title (ignoring case, untitled last), or by course name then title', () => {
    const notes = [note('a', 'krebs', '2026-10-01'), note('b', 'Atoms', '2026-10-03', 'k2'), note('c', '', '2026-10-02', 'k1'), note('d', 'Cells', '2026-09-01', 'k1')]
    const names: Record<string, string> = { k1: 'Biology', k2: 'Chemistry' }
    expect(sortNotes(notes, 'edited', names).map(n => n.id)).toEqual(['b', 'c', 'a', 'd'])
    expect(sortNotes(notes, 'title', names).map(n => n.id)).toEqual(['b', 'd', 'a', 'c'])
    expect(sortNotes(notes, 'course', names).map(n => n.id)).toEqual(['d', 'c', 'b', 'a']) // Biology, Chemistry, then no course
  })
  it('decks: most due, by name, or newest', () => {
    const decks = [{ id: '1', name: 'b deck', due: 2, created_at: '2026-10-01' }, { id: '2', name: 'A deck', due: 9, created_at: '2026-09-01' }, { id: '3', name: 'c deck', due: 2, created_at: '2026-10-05' }]
    expect(sortDecks(decks, 'due').map(d => d.id)).toEqual(['2', '1', '3']) // ties by name
    expect(sortDecks(decks, 'name').map(d => d.id)).toEqual(['2', '1', '3'])
    expect(sortDecks(decks, 'newest').map(d => d.id)).toEqual(['3', '1', '2'])
  })
  it('lectures: newest, oldest or by title', () => {
    const ls = [{ id: '1', title: 'Week 2', recorded_at: '2026-10-02' }, { id: '2', title: 'week 10', recorded_at: '2026-10-09' }, { id: '3', title: 'Intro', recorded_at: '2026-09-01' }]
    expect(sortLectures(ls, 'newest').map(l => l.id)).toEqual(['2', '1', '3'])
    expect(sortLectures(ls, 'oldest').map(l => l.id)).toEqual(['3', '1', '2'])
    expect(sortLectures(ls, 'title').map(l => l.id)).toEqual(['3', '1', '2']) // numbers in titles sort as numbers: Week 2 before week 10
  })
  it('does not change the list it is given', () => {
    const ls = [{ id: '1', title: 'B', recorded_at: '2026-10-02' }, { id: '2', title: 'A', recorded_at: '2026-10-01' }]
    sortLectures(ls, 'title')
    expect(ls.map(l => l.id)).toEqual(['1', '2'])
  })
})
