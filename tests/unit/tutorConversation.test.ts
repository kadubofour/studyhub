import { describe, it, expect } from 'vitest'
import { dayHeading, nearBottom, timeOf, transcript } from '@/lib/tutor/conversation'

describe('nearBottom', () => {
  it('is true when the end of the conversation is in view or just below it, false when scrolled up', () => {
    expect(nearBottom({ scrollY: 1000, viewport: 800, endY: 1800 })).toBe(true)
    expect(nearBottom({ scrollY: 900, viewport: 800, endY: 1800 })).toBe(true) // 100 below the window
    expect(nearBottom({ scrollY: 500, viewport: 800, endY: 1800 })).toBe(false)
  })
  it('is true when the conversation is shorter than the window', () => {
    expect(nearBottom({ scrollY: 0, viewport: 800, endY: 300 })).toBe(true)
  })
})

describe('dayHeading', () => {
  const now = new Date(2026, 9, 16, 15, 0)
  it('says Today and Yesterday, and otherwise the date', () => {
    expect(dayHeading(new Date(2026, 9, 16, 1, 0).toISOString(), now)).toBe('Today')
    expect(dayHeading(new Date(2026, 9, 15, 23, 59).toISOString(), now)).toBe('Yesterday')
    expect(dayHeading(new Date(2026, 9, 3, 9, 0).toISOString(), now)).toMatch(/3/)
    expect(dayHeading(new Date(2026, 9, 3, 9, 0).toISOString(), now)).toMatch(/Oct/)
  })
  it('adds the year for another year, and nothing for no time', () => {
    expect(dayHeading(new Date(2025, 11, 30, 9, 0).toISOString(), now)).toMatch(/2025/)
    expect(dayHeading('', now)).toBe('')
    expect(dayHeading('not a date', now)).toBe('')
  })
})

describe('timeOf', () => {
  it('is empty for a message with no time yet, and for nonsense', () => {
    expect(timeOf('')).toBe('')
    expect(timeOf('nope')).toBe('')
  })
  it('shows hours and minutes', () => {
    expect(timeOf(new Date(2026, 9, 16, 14, 5).toISOString())).toMatch(/2:05|14:05/)
  })
})

describe('transcript', () => {
  const msg = (role: 'user' | 'assistant', content: string, status: 'ok' | 'cut_off' = 'ok', id = 'x') => ({ id, role, content, status })
  it('is the title, then each turn as You: or Tutor:', () => {
    expect(transcript('Krebs', [msg('user', 'Why?'), msg('assistant', 'Because **NADH**.')])).toBe('Krebs\n\nYou: Why?\n\nTutor: Because **NADH**.')
  })
  it('leaves out a message that is only pending, and marks a cut-off reply', () => {
    expect(transcript('T', [msg('user', 'Q', 'ok', 'pending')])).toBe('T')
    expect(transcript('T', [msg('user', 'Q'), msg('assistant', 'It carries', 'cut_off')])).toBe('T\n\nYou: Q\n\nTutor: It carries (cut off)')
  })
})
