import { describe, it, expect } from 'vitest'
import { filterPalette, type PaletteItem } from '@/lib/shell/palette'

const go = (label: string, href: string, keywords = ''): PaletteItem => ({ id: `go:${href}`, group: 'Go to', label, keywords, run: { href } })
const doIt = (label: string, action: string, keywords = ''): PaletteItem => ({ id: `do:${action}`, group: 'Do', label, keywords, run: { action } })
const items: PaletteItem[] = [
  doIt('New note', 'new-note', 'write create'), doIt('Start focus', 'focus', 'timer pomodoro'), doIt('Upload', 'upload', 'pdf slides file'),
  go('Home', '/home'), go('Planner', '/planner', 'tasks calendar exams'), go('Notes', '/notes'), go('Flashcards', '/flashcards', 'cards decks review'),
  { id: 'course:k1', group: 'Courses', label: 'Biology', run: { href: '/courses/k1' } },
  { id: 'recent:n1', group: 'Recent', label: 'Krebs cycle', hint: 'Note', run: { href: '/notes/n1' } },
  { id: 'recent:n2', group: 'Recent', label: 'Café revision', hint: 'Note', run: { href: '/notes/n2' } },
]
const labels = (q: string) => filterPalette(items, q).map(i => i.label)

describe('filterPalette', () => {
  it('with nothing typed: what can be done, then where to go, then recent material', () => {
    expect(labels('')).toEqual(['New note', 'Start focus', 'Upload', 'Home', 'Planner', 'Notes', 'Flashcards', 'Biology', 'Krebs cycle', 'Café revision'])
  })
  it('finds by name, any case, and by what a thing is also called', () => {
    expect(labels('PLAN')).toEqual(['Planner'])
    expect(labels('timer')).toEqual(['Start focus'])
    expect(labels('exams')).toEqual(['Planner'])
    expect(labels('krebs')).toEqual(['Krebs cycle'])
  })
  it('needs every word typed to match', () => {
    expect(labels('new note')).toEqual(['New note'])
    expect(labels('new cards')).toEqual([])
  })
  it('puts names that start with what was typed first', () => {
    expect(labels('no')).toEqual(['Notes', 'New note']) // "Notes" starts with it; "New note" only has a word that does
  })
  it('ignores accents', () => {
    expect(labels('cafe')).toEqual(['Café revision'])
  })
  it('finds nothing for nonsense', () => {
    expect(labels('zzzz')).toEqual([])
  })
})
