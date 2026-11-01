// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import type { Quiz, QuizAttempt } from '@/lib/quiz/types'

const saveAttempt = vi.fn(async () => {})
const finishAttempt = vi.fn(async (_sb: unknown, id: string, answers: QuizAttempt['answers'], correct: number) =>
  ({ id, quiz_id: 'qz', answers, correct, total: 3, started_at: '', finished_at: new Date().toISOString() }))
const createCards = vi.fn(async () => [])
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/quizzes', () => ({ saveAttempt: (...a: unknown[]) => saveAttempt(...(a as [])), finishAttempt: (...a: [unknown, string, QuizAttempt['answers'], number]) => finishAttempt(...a) }))
vi.mock('@/lib/data/cards', () => ({ createCards: (...a: unknown[]) => createCards(...(a as [])) }))
vi.mock('@/lib/data/decks', () => ({ listDecksWithDue: async () => [], createDeck: async () => ({ id: 'd-new' }) }))

import { QuizPlayer } from '@/components/quiz/QuizPlayer'
import { QuizResults } from '@/components/quiz/QuizResults'
import { ToastProvider } from '@/components/providers/ToastProvider'

const quiz: Quiz = { id: 'qz', note_id: 'n1', title: 'Krebs quiz', created_at: '', questions: [
  { id: 'q1', type: 'mcq', prompt: 'Where?', options: ['Cytoplasm', 'Matrix', 'Nucleus', 'Ribosome'], answer: 'Matrix', explanation: 'In the matrix.' },
  { id: 'q2', type: 'true_false', prompt: 'It makes glucose.', options: null, answer: 'false', explanation: 'It breaks it down.' },
  { id: 'q3', type: 'short', prompt: 'Main product?', options: null, answer: 'NADH', explanation: 'NADH carries electrons.' },
] }
const attempt = (answers: QuizAttempt['answers'] = {}): QuizAttempt => ({ id: 'a1', quiz_id: 'qz', answers, correct: 0, total: 3, started_at: '', finished_at: null })
const fetchMock = vi.fn()

beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); saveAttempt.mockClear(); finishAttempt.mockClear(); createCards.mockClear() })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('QuizPlayer', () => {
  it('warns before leaving the page while an answer is still saving', async () => {
    let finishSave = () => {}
    saveAttempt.mockImplementationOnce(() => new Promise<void>(r => { finishSave = r }))
    render(<QuizPlayer quiz={quiz} attempt={attempt()} onFinished={vi.fn()} />)
    const leave = () => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented }
    expect(leave()).toBe(false)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Matrix' })) })
    expect(leave()).toBe(true) // the browser asks "Leave site?" instead of losing the answer
    await act(async () => { finishSave() })
    expect(leave()).toBe(false)
  })
  it('marks each answer, shows the explanation, saves progress and finishes', async () => {
    const onFinished = vi.fn()
    render(<QuizPlayer quiz={quiz} attempt={attempt()} onFinished={onFinished} />)
    expect(screen.getByText('Question 1 of 3')).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Matrix' })) })
    expect(screen.getByText(/Correct\./)).toBeTruthy()
    expect(screen.getByText('In the matrix.')).toBeTruthy()
    expect(saveAttempt).toHaveBeenCalledWith(expect.anything(), 'a1', { q1: { given: 'Matrix', correct: true, feedback: null } }, 1)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'True' })) })
    expect(screen.getByText(/Not quite\./)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ correct: true, feedback: 'Yes.' }), { status: 200 }))
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: 'it makes NADH' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Check' })) })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/ai/quiz/mark')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'See results' })) })
    expect(finishAttempt).toHaveBeenCalledWith(expect.anything(), 'a1', expect.any(Object), 2)
    expect(onFinished).toHaveBeenCalled()
  })
  it('resumes at the first unanswered question', () => {
    render(<QuizPlayer quiz={quiz} attempt={attempt({ q1: { given: 'Matrix', correct: true, feedback: null } })} onFinished={() => {}} />)
    expect(screen.getByText('Question 2 of 3')).toBeTruthy()
  })
  it('reopens on the last question, ready for results, when every answer was given before a refresh', () => {
    render(<QuizPlayer quiz={quiz} attempt={attempt({
      q1: { given: 'Matrix', correct: true, feedback: null },
      q2: { given: 'false', correct: true, feedback: null },
      q3: { given: 'NADH', correct: true, feedback: null },
    })} onFinished={() => {}} />)
    expect(screen.getByText('Question 3 of 3')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'See results' })).toBeTruthy()
  })
  it('says so when finishing fails, instead of silently doing nothing', async () => {
    finishAttempt.mockRejectedValueOnce(new Error('offline'))
    const onFinished = vi.fn()
    render(<QuizPlayer quiz={quiz} attempt={attempt({
      q1: { given: 'Matrix', correct: true, feedback: null },
      q2: { given: 'false', correct: true, feedback: null },
      q3: { given: 'NADH', correct: true, feedback: null },
    })} onFinished={onFinished} />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'See results' })) })
    expect(onFinished).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toMatch(/Couldn't finish the quiz/)
  })
  it('lets the student mark themselves when AI marking is unavailable', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429 }))
    render(<QuizPlayer quiz={quiz} attempt={attempt({ q1: { given: 'Matrix', correct: true, feedback: null }, q2: { given: 'false', correct: true, feedback: null } })} onFinished={() => {}} />)
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: 'electrons' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Check' })) })
    expect(screen.getByText("Couldn't mark this automatically. Expected: NADH")).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'I was wrong' })) })
    expect(saveAttempt).toHaveBeenLastCalledWith(expect.anything(), 'a1', expect.objectContaining({ q3: { given: 'electrons', correct: false, feedback: null } }), 2)
  })
})

describe('QuizResults', () => {
  it('shows the score, the change since last time, and turns wrong answers into cards', async () => {
    const done: QuizAttempt = { ...attempt({ q1: { given: 'Matrix', correct: true, feedback: null }, q2: { given: 'true', correct: false, feedback: null }, q3: { given: 'x', correct: false, feedback: 'No.' } }), correct: 1, finished_at: 'now' }
    const prev: QuizAttempt = { ...done, id: 'a0', correct: 0 }
    render(<ToastProvider><QuizResults quiz={quiz} attempt={done} previous={prev} onRetake={() => {}} /></ToastProvider>)
    expect(screen.getByText('1 / 3')).toBeTruthy()
    expect(screen.getByText('Last time 0/3 · up 1')).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Make cards from 2 wrong answers' })) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save 2 cards' })) })
    expect(createCards).toHaveBeenCalledWith(expect.anything(), 'd-new', [
      { front: 'It makes glucose.', back: 'False. It breaks it down.' },
      { front: 'Main product?', back: 'NADH. NADH carries electrons.' },
    ], { noteId: 'n1' }) // cards remember the quiz's note
  })
})

describe('maths in a quiz', () => {
  const maths: Quiz = { id: 'qm', note_id: 'n1', title: 'Vectors', created_at: '', questions: [
    { id: 'm1', type: 'mcq', prompt: 'The midpoint of $A$ and $B$ is?', options: ['$\\frac{\\vec a+\\vec b}{2}$', '$\\vec a-\\vec b$', '$2\\vec a$', '$\\vec 0$'], answer: '$\\frac{\\vec a+\\vec b}{2}$',
      explanation: 'Equal weights give $\\frac{\\vec a+\\vec b}{2}$.' },
    { id: 'm2', type: 'mcq', prompt: 'x?', options: ['plain one', 'plain two', 'plain three', 'plain four'], answer: 'plain one', explanation: '' },
  ] }
  const open = (q: Quiz) => render(<ToastProvider><QuizPlayer quiz={q} attempt={attempt()} onFinished={() => {}} /></ToastProvider>)

  it('draws the answer choices as maths, not as LaTeX text', () => {
    const { container } = open(maths)
    expect(container.querySelectorAll('button .katex-html').length).toBe(4)
    expect([...container.querySelectorAll('button')].some(b => b.textContent?.includes('$'))).toBe(false) // no dollar signs left showing
  })
  it('draws the answer and the explanation as maths once a choice is made', async () => {
    const { container } = open(maths)
    await act(async () => { fireEvent.click(container.querySelectorAll('button')[1]) }) // a wrong choice (the second)
    const note = screen.getByText(/Not quite/).closest('div') as HTMLElement
    expect(note.querySelectorAll('.katex-html').length).toBeGreaterThanOrEqual(2) // the answer, and the explanation
    expect(note.textContent).not.toContain('$')
    void container
  })
  it('draws the results as maths too: the answers, the feedback and the explanation', () => {
    const done: QuizAttempt = { ...attempt({ m1: { given: '$\\vec a-\\vec b$', correct: false, feedback: 'You subtracted; add, then halve: $\\frac12$.' }, m2: { given: 'plain one', correct: true, feedback: null } }), finished_at: 'x', correct: 1, total: 2 }
    const { container } = render(<ToastProvider><QuizResults quiz={maths} attempt={done} previous={null} onRetake={() => {}} /></ToastProvider>)
    const answers = container.querySelector('ul, ol, section') ? container : container
    expect(answers.querySelectorAll('.katex-html').length).toBeGreaterThanOrEqual(5) // the question, your answer, the answer, the feedback, the explanation
    expect(screen.queryByText(/\$/)).toBeNull() // no dollar signs left in view
  })
  it('leaves plain text as it is', () => {
    open({ ...maths, questions: [maths.questions[1]] })
    expect(screen.getByRole('button', { name: /plain two/ }).textContent).toContain('plain two')
  })
})
