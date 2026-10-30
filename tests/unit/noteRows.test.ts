import { describe, it, expect } from 'vitest'
import { editedLine, groupByDate, groupLabel, previewLine, rowDate } from '@/lib/notes/noteRows'

describe('previewLine', () => {
  it('is the first line with words, as plain text', () => {
    expect(previewLine('\n\n## The **Krebs** cycle\nmore')).toBe('The Krebs cycle')
    expect(previewLine('- [ ] buy *milk*')).toBe('buy milk')
    expect(previewLine('1. First step')).toBe('First step')
    expect(previewLine('> a quote with `code`')).toBe('a quote with code')
  })
  it('drops pictures and link addresses, and keeps the words of links and maths', () => {
    expect(previewLine('![board](note-image:abc)\nSee [the slides](https://x.y) for $x^2$')).toBe('See the slides for x^2')
  })
  it('skips a table\'s rule and a horizontal rule, and reads a table row as words', () => {
    expect(previewLine('---\n| Stage | Where |\n| --- | --- |')).toBe('Stage Where')
  })
  it('is empty for an empty note', () => {
    expect(previewLine('')).toBe('')
    expect(previewLine(null)).toBe('')
    expect(previewLine('\n  \n')).toBe('')
  })
})

describe('date groups', () => {
  const now = new Date(2026, 9, 30, 16, 0) // 30 October 2026, 4 pm
  const at = (d: number, m = 9, y = 2026) => new Date(y, m, d, 9, 0).toISOString()
  it('says Today, Yesterday, Previous 7 days, Previous 30 days, then the month', () => {
    expect(groupLabel(at(30), now)).toBe('Today')
    expect(groupLabel(at(29), now)).toBe('Yesterday')
    expect(groupLabel(at(25), now)).toBe('Previous 7 days')
    expect(groupLabel(at(5), now)).toBe('Previous 30 days')
    expect(groupLabel(at(2, 8), now)).toBe('September')
    expect(groupLabel(at(2, 8, 2025), now)).toBe('September 2025')
  })
  it('keeps the order given and starts a new group when the label changes', () => {
    const notes = [{ id: 'a', updated_at: at(30) }, { id: 'b', updated_at: at(30) }, { id: 'c', updated_at: at(29) }]
    expect(groupByDate(notes, now).map(g => [g.label, g.notes.map(n => n.id)])).toEqual([['Today', ['a', 'b']], ['Yesterday', ['c']]])
  })
  it('dates a row by its time today, its weekday this week, and its date before that', () => {
    expect(rowDate(new Date(2026, 9, 30, 9, 5).toISOString(), now)).toBe('09:05')
    expect(rowDate(at(29), now)).toBe('Yesterday')
    expect(rowDate(at(26), now)).toBe('Monday')
    expect(rowDate(at(5), now)).toBe('05/10/26')
  })
  it('writes the edited line above an open note', () => {
    expect(editedLine(new Date(2026, 9, 30, 16, 12).toISOString())).toBe('30 October 2026 at 16:12')
  })
})
