import { describe, it, expect, vi, beforeEach } from 'vitest'

const createNote = vi.fn(async (..._a: unknown[]) => ({ id: 'n9' }))
const createDeck = vi.fn(async (..._a: unknown[]) => ({ id: 'd9' }))
const createCards = vi.fn(async (..._a: unknown[]) => [])
const createTask = vi.fn(async (..._a: unknown[]) => ({ id: 't9' }))
vi.mock('@/lib/data/notes', () => ({ createNote: (...a: unknown[]) => createNote(...a) }))
vi.mock('@/lib/data/decks', () => ({ createDeck: (...a: unknown[]) => createDeck(...a) }))
vi.mock('@/lib/data/cards', () => ({ createCards: (...a: unknown[]) => createCards(...a) }))
vi.mock('@/lib/data/tasks', () => ({ createTask: (...a: unknown[]) => createTask(...a) }))
const quizInsert = vi.fn()
const sb = { from: (t: string) => ({ insert: (row: unknown) => { quizInsert(t, row); return { select: () => ({ single: async () => ({ data: { id: 'q9' }, error: null }) }) } } }) } as never
import { applyProposal } from '@/lib/tutor/apply'
import type { Proposal } from '@/lib/ai/tutorTools'

const chat = { course_id: 'c1', note_id: 'n1' }
beforeEach(() => { createNote.mockClear(); createDeck.mockClear(); createCards.mockClear(); createTask.mockClear(); quizInsert.mockClear() })
const p = <T extends Proposal>(x: T) => x

describe('applyProposal', () => {
  it('saves a note in the proposal\'s course, or the chat\'s', async () => {
    expect(await applyProposal(sb, p({ id: 'p', tool: 'create_note', state: 'pending', args: { title: 'T', body: 'B', course_id: null } }), chat)).toEqual({ itemId: 'n9', itemKind: 'note' })
    expect(createNote).toHaveBeenCalledWith(sb, { title: 'T', content_md: 'B', course_id: 'c1' })
  })
  it('makes a new deck for flashcards, or uses the existing one', async () => {
    const args = { deck_id: null, deck_name: 'Krebs', cards: [{ front: 'Q', back: 'A' }], course_id: null }
    expect(await applyProposal(sb, p({ id: 'p', tool: 'create_flashcards', state: 'pending', args }), chat)).toEqual({ itemId: 'd9', itemKind: 'deck' })
    expect(createDeck).toHaveBeenCalledWith(sb, { name: 'Krebs', course_id: 'c1' })
    expect(createCards).toHaveBeenCalledWith(sb, 'd9', args.cards)
    createDeck.mockClear()
    expect(await applyProposal(sb, p({ id: 'p', tool: 'create_flashcards', state: 'pending', args: { ...args, deck_id: 'd1', deck_name: null } }), chat)).toEqual({ itemId: 'd1', itemKind: 'deck' })
    expect(createDeck).not.toHaveBeenCalled()
  })
  it('saves a quiz on the chat\'s note, and refuses when the chat has none', async () => {
    const quiz = p({ id: 'p', tool: 'create_quiz', state: 'pending', args: { title: 'Quiz', questions: [] } })
    expect(await applyProposal(sb, quiz, chat)).toEqual({ itemId: 'q9', itemKind: 'quiz' })
    expect(quizInsert).toHaveBeenCalledWith('quizzes', { note_id: 'n1', title: 'Quiz', questions: [] })
    await expect(applyProposal(sb, quiz, { course_id: null, note_id: null })).rejects.toThrow('no_note')
  })
  it('saves a task', async () => {
    const args = { title: 'Read', type: 'reading' as const, due_at: null, priority: 'normal' as const, course_id: null }
    expect(await applyProposal(sb, p({ id: 'p', tool: 'create_task', state: 'pending', args }), chat)).toEqual({ itemId: 't9', itemKind: 'task' })
    expect(createTask).toHaveBeenCalledWith(sb, { ...args, course_id: 'c1' })
  })
  it('a failure part-way doesn\'t report success', async () => {
    createCards.mockRejectedValueOnce(new Error('rls'))
    await expect(applyProposal(sb, p({ id: 'p', tool: 'create_flashcards', state: 'pending', args: { deck_id: 'd1', deck_name: null, cards: [{ front: 'Q', back: 'A' }], course_id: null } }), chat)).rejects.toThrow('rls')
  })
})
