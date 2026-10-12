import { describe, it, expect } from 'vitest'
import { cardsDue, courseSections, examLine, summaryLine } from '@/lib/course/summary'
import type { LibraryItem, Kind } from '@/lib/library/items'

const it_ = (kind: Kind, id: string, course: string | null, at: string, due?: number): LibraryItem =>
  ({ kind, id, title: id, course_id: course, at, meta: '', href: `/${kind}/${id}`, ...(due === undefined ? {} : { due }) })
const NOW = new Date('2026-10-12T10:00:00Z')

describe('courseSections', () => {
  const items = [
    ...Array.from({ length: 7 }, (_, i) => it_('note', `n${i}`, 'bio', `2026-10-0${i + 1}T00:00:00Z`)),
    it_('deck', 'd1', 'bio', '2026-10-01T00:00:00Z'),
    it_('deck', 'd2', 'other', '2026-10-01T00:00:00Z'),
    it_('chat', 'c1', 'bio', '2026-10-02T00:00:00Z'),
  ]
  it('keeps only this course, in the usual order, skipping empty kinds', () => {
    expect(courseSections(items, 'bio').map(s => [s.kind, s.total])).toEqual([['note', 7], ['deck', 1], ['chat', 1]])
  })
  it('shows the newest five of a kind but counts them all', () => {
    const notes = courseSections(items, 'bio')[0]
    expect(notes.shown.map(i => i.id)).toEqual(['n6', 'n5', 'n4', 'n3', 'n2'])
    expect(notes.total).toBe(7)
  })
})

describe('summaryLine', () => {
  it('counts each kind with singular and plural', () => {
    const items = [it_('note', 'a', 'x', ''), it_('note', 'b', 'x', ''), it_('deck', 'c', 'x', '')]
    expect(summaryLine(items)).toBe('2 notes · 1 deck')
  })
  it('says so when empty', () => { expect(summaryLine([])).toBe('Nothing here yet') })
})

describe('cardsDue', () => {
  it('adds up the decks due counts, ignoring other kinds', () => {
    expect(cardsDue([it_('deck', 'a', 'x', '', 3), it_('deck', 'b', 'x', '', 4), it_('deck', 'c', 'x', ''), it_('note', 'n', 'x', '')])).toBe(7)
  })
})

describe('examLine', () => {
  const at = (iso: string) => ({ title: 'Midterm', due_at: iso })
  it('says how far away it is', () => {
    expect(examLine(at('2026-10-21T10:00:00Z'), NOW, 'UTC')).toBe('Midterm · in 9 days')
    expect(examLine(at('2026-10-13T10:00:00Z'), NOW, 'UTC')).toBe('Midterm · tomorrow')
    expect(examLine(at('2026-10-12T15:00:00Z'), NOW, 'UTC')).toBe('Midterm · today')
  })
})
