import { describe, it, expect } from 'vitest'
import { MAX_CARDS, parseToolCall, toolDefinitions, type ToolContext } from '@/lib/ai/tutorTools'

const C1 = '11111111-1111-4111-8111-111111111111', D1 = '22222222-2222-4222-8222-222222222222', N1 = '33333333-3333-4333-8333-333333333333'
const ctx: ToolContext = { noteId: N1, courseIds: [C1], deckIds: [D1] }
const parse = (name: string, args: object | string, c: ToolContext = ctx) => parseToolCall(name, typeof args === 'string' ? args : JSON.stringify(args), c, 'p1')
const card = (n: number) => ({ front: `Q${n}`, back: `A${n}` })
const mcq = (p: string) => ({ type: 'mcq', prompt: p, options: ['a', 'b', 'c', 'd'], answer: 'b', explanation: 'x' })

describe('tool definitions', () => {
  it('offers the quiz tool only when the chat is attached to a note', () => {
    const names = (n: boolean) => toolDefinitions(n).map(t => (t as { name: string }).name)
    expect(names(true)).toEqual(['create_note', 'create_flashcards', 'create_quiz', 'create_task'])
    expect(names(false)).toEqual(['create_note', 'create_flashcards', 'create_task'])
  })
})

describe('create_note', () => {
  it('becomes a pending proposal, trimmed', () => {
    expect(parse('create_note', { title: '  Krebs  ', body: ' # Krebs\nNADH ', course_id: C1 })).toEqual({
      id: 'p1', tool: 'create_note', state: 'pending', args: { title: 'Krebs', body: '# Krebs\nNADH', course_id: C1 },
    })
  })
  it('is dropped for an empty title or body, or a course that isn\'t the student\'s', () => {
    expect(parse('create_note', { title: ' ', body: 'x' })).toBeNull()
    expect(parse('create_note', { title: 'x', body: '' })).toBeNull()
    expect(parse('create_note', { title: 'x', body: 'y', course_id: '99999999-9999-4999-8999-999999999999' })).toBeNull()
  })
})

describe('create_flashcards', () => {
  it('needs an existing deck of the student\'s or a new deck name', () => {
    expect(parse('create_flashcards', { deck_id: D1, cards: [card(1)] })?.args).toMatchObject({ deck_id: D1, deck_name: null })
    expect(parse('create_flashcards', { deck_name: 'Biology', cards: [card(1)] })?.args).toMatchObject({ deck_id: null, deck_name: 'Biology' })
    expect(parse('create_flashcards', { cards: [card(1)] })).toBeNull()
    expect(parse('create_flashcards', { deck_id: '99999999-9999-4999-8999-999999999999', cards: [card(1)] })).toBeNull()
  })
  it('takes 1 to 30 cards with both sides', () => {
    expect(parse('create_flashcards', { deck_name: 'B', cards: Array.from({ length: MAX_CARDS }, (_, i) => card(i)) })).not.toBeNull()
    expect(parse('create_flashcards', { deck_name: 'B', cards: Array.from({ length: MAX_CARDS + 1 }, (_, i) => card(i)) })).toBeNull()
    expect(parse('create_flashcards', { deck_name: 'B', cards: [] })).toBeNull()
    expect(parse('create_flashcards', { deck_name: 'B', cards: [{ front: 'Q', back: ' ' }] })).toBeNull()
  })
})

describe('create_quiz', () => {
  it('numbers the questions q1, q2… and needs at least 3 valid ones', () => {
    const ok = parse('create_quiz', { title: 'Krebs quiz', questions: [mcq('A'), mcq('B'), mcq('C')] })
    expect((ok?.args as { questions: { id: string }[] }).questions.map(q => q.id)).toEqual(['q1', 'q2', 'q3'])
    expect(parse('create_quiz', { title: 'x', questions: [mcq('A'), mcq('B')] })).toBeNull()
    expect(parse('create_quiz', { title: 'x', questions: [mcq('A'), mcq('B'), { ...mcq('C'), options: ['a', 'a', 'c', 'd'] }] })).toBeNull()
  })
  it('is dropped when the chat has no note', () => {
    expect(parse('create_quiz', { title: 'x', questions: [mcq('A'), mcq('B'), mcq('C')] }, { ...ctx, noteId: null })).toBeNull()
  })
})

describe('create_task', () => {
  it('defaults the type and priority, and turns a plain date into a time', () => {
    expect(parse('create_task', { title: 'Read ch 4', due_date: '2030-05-17' })?.args).toEqual({
      title: 'Read ch 4', type: 'other', due_at: '2030-05-17T09:00:00.000Z', priority: 'normal', course_id: null,
    })
  })
  it('is dropped for an empty title, an unknown type or an unreadable date', () => {
    expect(parse('create_task', { title: '' })).toBeNull()
    expect(parse('create_task', { title: 'x', type: 'party' })).toBeNull()
    expect(parse('create_task', { title: 'x', due_date: 'next friday' })).toBeNull()
  })
})

describe('bad calls', () => {
  it('an unknown tool or arguments that aren\'t JSON are dropped', () => {
    expect(parse('delete_everything', {})).toBeNull()
    expect(parse('create_note', '{not json')).toBeNull()
    expect(parse('create_note', '[]')).toBeNull()
  })
})
