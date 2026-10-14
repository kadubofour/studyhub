import { describe, it, expect } from 'vitest'
import { homeMaterial } from '@/lib/home/material'

const note = (id: string, course: string | null, at: string) => ({ id, course_id: course, title: `Note ${id}`, updated_at: at })
const deck = (id: string, course: string | null, at: string) => ({ id, course_id: course, name: `Deck ${id}`, created_at: at })
const lecture = (id: string, course: string | null, at: string) => ({ id, course_id: course, title: `Lecture ${id}`, recorded_at: at })

describe('homeMaterial', () => {
  const m = homeMaterial(
    [note('n1', 'bio', '2026-10-10T10:00:00Z'), note('n2', 'bio', '2026-10-12T10:00:00Z'), note('n3', null, '2026-10-11T10:00:00Z')],
    [deck('d1', 'bio', '2026-10-09T10:00:00Z'), deck('d2', 'chem', '2026-10-13T10:00:00Z')],
    [lecture('l1', 'chem', '2026-10-08T10:00:00Z')],
  )
  it('counts notes, decks and lectures per course, leaving out what has no course', () => {
    expect(m.counts).toEqual({ bio: { notes: 2, decks: 1, lectures: 0 }, chem: { notes: 0, decks: 1, lectures: 1 } })
  })
  it('lists the newest material first, across kinds, with a link to each', () => {
    expect(m.recent.map(r => r.id)).toEqual(['d2', 'n2', 'n3', 'n1', 'd1', 'l1'])
    expect(m.recent[0]).toMatchObject({ kind: 'deck', title: 'Deck d2', course_id: 'chem', href: '/flashcards/d2' })
    expect(m.recent[1]).toMatchObject({ kind: 'note', href: '/notes/n2' })
    expect(m.recent[5]).toMatchObject({ kind: 'lecture', href: '/lectures/l1' })
  })
  it('keeps only the newest few', () => {
    const many = homeMaterial(Array.from({ length: 12 }, (_, i) => note(`n${i}`, 'bio', `2026-10-${String(i + 1).padStart(2, '0')}T00:00:00Z`)), [], [], 5)
    expect(many.recent).toHaveLength(5)
    expect(many.recent[0].id).toBe('n11')
  })
  it('is empty for nothing', () => {
    expect(homeMaterial([], [], [])).toEqual({ counts: {}, recent: [] })
  })
})
