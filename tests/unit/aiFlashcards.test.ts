import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanCards, noteToFlashcards, MAX_CARDS } from '@/lib/ai/flashcards'
import { AiEmptyError } from '@/lib/ai/openai'

const parse = vi.fn()
const client = { responses: { parse } }
beforeEach(() => { parse.mockReset(); process.env.OPENAI_API_KEY = 'k' })
afterEach(() => { delete process.env.OPENAI_API_KEY })

describe('cleanCards', () => {
  it('trims, drops empty sides and duplicate fronts, and caps the number and length', () => {
    const out = cleanCards([
      { front: '  What is ATP? ', back: ' Energy currency ' },
      { front: 'what is atp?', back: 'dup' },
      { front: '', back: 'no front' },
      { front: 'No back', back: '   ' },
      { front: 'x'.repeat(2000), back: 'long' },
    ])
    expect(out[0]).toEqual({ front: 'What is ATP?', back: 'Energy currency' })
    expect(out).toHaveLength(2)
    expect(out[1].front).toHaveLength(1000)
    expect(cleanCards(Array.from({ length: 60 }, (_, i) => ({ front: `Q${i}`, back: 'A' })))).toHaveLength(MAX_CARDS)
  })
})

describe('noteToFlashcards', () => {
  it('uses the light model and returns cleaned cards', async () => {
    parse.mockResolvedValue({ status: 'completed', output: [], output_parsed: { cards: [{ front: 'Q', back: 'A' }] } })
    const out = await noteToFlashcards(client as never, { title: 'T', content_md: 'body' })
    expect(out).toEqual({ cards: [{ front: 'Q', back: 'A' }] })
    expect((parse.mock.calls[0][0] as { model: string }).model).toBe('gpt-6-luna')
  })
  it('throws AiEmptyError when nothing usable comes back', async () => {
    parse.mockResolvedValue({ status: 'completed', output: [], output_parsed: { cards: [{ front: '', back: '' }] } })
    await expect(noteToFlashcards(client as never, { title: 'T', content_md: 'b' })).rejects.toBeInstanceOf(AiEmptyError)
  })
})
