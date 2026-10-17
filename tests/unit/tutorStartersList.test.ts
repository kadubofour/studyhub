import { describe, it, expect } from 'vitest'
import { FOLLOW_UPS, STARTERS, starterMessage } from '@/lib/tutor/starters'
import { aboutLine, filterChats } from '@/lib/tutor/chatList'
import type { TutorChat } from '@/lib/data/tutor'

const chat = (id: string, title: string, over: Partial<TutorChat> = {}): TutorChat =>
  ({ id, title, course_id: null, note_id: null, lecture_id: null, guided: false, created_at: '', updated_at: '2026-10-01T00:00:00Z', ...over })

describe('starters', () => {
  it('are four, each a message ready to finish', () => {
    expect(STARTERS.map(s => s.id)).toEqual(['explain', 'quiz', 'revise', 'summarise'])
    for (const s of STARTERS) expect(s.message.trim().length).toBeGreaterThan(5)
  })
  it('fill in what the chat is about, or stay as they are', () => {
    const quiz = STARTERS.find(s => s.id === 'quiz')!
    expect(starterMessage(quiz, 'Krebs cycle')).toBe('Quiz me on Krebs cycle')
    expect(starterMessage(quiz, null)).toBe('Quiz me on ')
  })
  it('follow-ups are four messages a student would send', () => {
    expect(FOLLOW_UPS.map(f => f.label)).toEqual(['Explain it simpler', 'Give an example', 'Quiz me on this', 'Make flashcards'])
    for (const f of FOLLOW_UPS) expect(f.message.endsWith('.')).toBe(true)
  })
})

describe('filterChats', () => {
  const chats = [
    chat('a', 'Krebs cycle', { course_id: 'bio', updated_at: '2026-10-03T00:00:00Z' }),
    chat('b', 'Integration help', { course_id: 'math', updated_at: '2026-10-05T00:00:00Z' }),
    chat('c', 'New chat', { course_id: 'bio', note_id: 'n1', updated_at: '2026-10-04T00:00:00Z' }),
  ]
  const contexts = { c: { kind: 'note' as const, title: 'Glycolysis notes' } }
  it('lists newest first', () => {
    expect(filterChats(chats, contexts, null, '').map(c => c.id)).toEqual(['b', 'c', 'a'])
  })
  it('finds a word in the title or in the note or lecture the chat is about, ignoring case', () => {
    expect(filterChats(chats, contexts, null, 'KREBS').map(c => c.id)).toEqual(['a'])
    expect(filterChats(chats, contexts, null, 'glycolysis').map(c => c.id)).toEqual(['c'])
    expect(filterChats(chats, contexts, null, '  ').map(c => c.id)).toHaveLength(3)
    expect(filterChats(chats, contexts, null, 'zzz')).toEqual([])
  })
  it('keeps only the course picked, and both together', () => {
    expect(filterChats(chats, contexts, 'bio', '').map(c => c.id)).toEqual(['c', 'a'])
    expect(filterChats(chats, contexts, 'bio', 'glyco').map(c => c.id)).toEqual(['c'])
  })
})

describe('aboutLine', () => {
  it('says what the chat is about', () => {
    expect(aboutLine({ kind: 'note', title: 'Krebs' })).toBe('Note: Krebs')
    expect(aboutLine({ kind: 'lecture', title: 'Week 3' })).toBe('Lecture: Week 3')
    expect(aboutLine(undefined)).toBeNull() // the course is shown beside the chat, not said twice
  })
})
