import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isFormulaic, validateQuestions, makeQuiz, type RawQuestion } from '@/lib/ai/quiz'
import { AiEmptyError } from '@/lib/ai/openai'

const all = ['mcq', 'true_false', 'short'] as const
const raw = (over: object) => ({ type: 'mcq', prompt: 'Where?', options: ['Cytoplasm', 'Matrix', 'Nucleus', 'Ribosome'], answer: 'matrix', explanation: 'Because.', ...over }) as RawQuestion

describe('validateQuestions', () => {
  it('keeps good questions, gives them ids, and normalises answers to the option text', () => {
    const qs = validateQuestions([raw({}), raw({ type: 'true_false', prompt: 'T?', options: null, answer: 'TRUE' }), raw({ type: 'short', prompt: 'Explain', options: null, answer: 'NADH' })], [...all], 10)
    expect(qs.map(q => q.id)).toEqual(['q1', 'q2', 'q3'])
    expect(qs[0].answer).toBe('Matrix')
    expect(qs[1]).toMatchObject({ answer: 'true', options: null })
  })
  it('drops broken questions', () => {
    const qs = validateQuestions([
      raw({ answer: 'Golgi' }),                                  // answer not an option
      raw({ options: ['a', 'b', 'c'] }),                         // not 4 options
      raw({ options: ['a', 'a', 'b', 'c'], answer: 'a' }),       // duplicate options
      raw({ type: 'true_false', options: null, answer: 'maybe' }),
      raw({ type: 'short', options: null, answer: '' }),
      raw({ prompt: '  ' }),
    ], [...all], 10)
    expect(qs).toEqual([])
  })
  it('only keeps the requested types and count', () => {
    const many = Array.from({ length: 12 }, (_, i) => raw({ prompt: `Q${i}` }))
    expect(validateQuestions(many, ['mcq'], 5)).toHaveLength(5)
    expect(validateQuestions(many, ['short'], 5)).toHaveLength(0)
  })
})

describe('makeQuiz', () => {
  const parse = vi.fn()
  beforeEach(() => parse.mockReset())
  it('asks for the requested count and types with the light model', async () => {
    parse.mockResolvedValue({ status: 'completed', output: [], output_parsed: { title: 'Krebs quiz', questions: [raw({}), raw({ prompt: 'B' }), raw({ prompt: 'C' })] } })
    const quiz = await makeQuiz({ responses: { parse } } as never, { title: 'Krebs', content_md: 'x' }, { count: 5, types: ['mcq'] })
    expect(quiz.title).toBe('Krebs quiz')
    expect(quiz.questions).toHaveLength(3)
    const p = parse.mock.calls[0][0] as { model: string; input: { content: string }[] }
    expect(p.model).toBe('gpt-6-luna')
    expect(p.input[0].content).toMatch(/5 questions/)
    expect(p.input[0].content).toMatch(/multiple choice/)
  })
  it('rejects a quiz with fewer than 3 usable questions', async () => {
    parse.mockResolvedValue({ status: 'completed', output: [], output_parsed: { title: 'x', questions: [raw({}), raw({ answer: 'nope' })] } })
    await expect(makeQuiz({ responses: { parse } } as never, { title: 'K', content_md: 'x' }, { count: 5, types: ['mcq'] })).rejects.toBeInstanceOf(AiEmptyError)
  })
})

describe('answers that cannot be typed accurately', () => {
  const short = (answer: string): RawQuestion => ({ type: 'short', prompt: 'What is it?', options: null, answer, explanation: 'Because.' })
  const mcq = (answer: string): RawQuestion => ({ type: 'mcq', prompt: 'Which?', options: [answer, 'x', 'y', 'z'], answer, explanation: 'Because.' })

  it('tells a formula, an expression or a symbol from a word, a name, a number or a short phrase', () => {
    for (const a of ['$\\frac{\\vec a+\\vec b}{2}$', '\\vec a-\\vec b', 'x^2', 'y = mx + c', 'a+b', 'p ∈ A', 'v⃗', '√2', 'x ≥ 3']) expect(isFormulaic(a), a).toBe(true)
    for (const a of ['Matrix', 'NADH', '3.5 m/s', '-5', 'the mitochondrial matrix', 'H2O', 'Kenneth Dadedzi', '12']) expect(isFormulaic(a), a).toBe(false)
  })
  it('never lets a formula through as a typed question', () => {
    const qs = validateQuestions([short('$\\frac{a+b}{2}$'), short('Matrix')], ['short'], 5)
    expect(qs.map(q => q.answer)).toEqual(['Matrix'])
  })
  it('welcomes a multiple choice question with a formula answer even when only short answers were asked for', () => {
    const qs = validateQuestions([mcq('$\\frac{a+b}{2}$'), mcq('Matrix')], ['short'], 5)
    expect(qs.map(q => q.type)).toEqual(['mcq']) // the formula one is kept; a plain multiple choice question was not asked for
  })
  it('keeps multiple choice with a formula answer when multiple choice was asked for', () => {
    expect(validateQuestions([mcq('$\\vec a+\\vec b$')], ['mcq', 'short'], 5)).toHaveLength(1)
  })
})
