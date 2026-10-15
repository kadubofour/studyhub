// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within, waitFor } from '@testing-library/react'
import type { Quiz, QuizAttempt } from '@/lib/quiz/types'
import { answerText, missedQuestions, optionLetter, percent, ringDash, scoreLine } from '@/lib/quiz/summary'

const saveAttempt = vi.fn(async () => {})
const finishAttempt = vi.fn(async (_sb: unknown, id: string, answers: QuizAttempt['answers'], correct: number) =>
  ({ id, quiz_id: 'qz', answers, correct, total: 3, started_at: '', finished_at: new Date().toISOString() }))
const listRecentQuizzes = vi.fn(async () => [] as { quiz: Quiz; attempts: number; best: { correct: number; total: number } | null }[])
const push = vi.fn()
const postAi = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/quizzes', () => ({
  saveAttempt: (...a: unknown[]) => saveAttempt(...(a as [])),
  finishAttempt: (...a: [unknown, string, QuizAttempt['answers'], number]) => finishAttempt(...a),
  listRecentQuizzes: () => listRecentQuizzes(),
}))
vi.mock('@/lib/data/cards', () => ({ createCards: vi.fn(async () => []) }))
vi.mock('@/lib/data/decks', () => ({ listDecksWithDue: async () => [], createDeck: async () => ({ id: 'd' }) }))
let notes = [
  { id: 'n1', title: 'Krebs cycle', course_id: 'c1', updated_at: '' }, { id: 'n2', title: 'Glycolysis', course_id: null, updated_at: '' },
]
vi.mock('@/lib/data/notes', () => ({ listNotes: async () => notes }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => [{ id: 'c1', name: 'Biology', color: '#1D9E75' }] }))
vi.mock('@/components/ai/aiFetch', () => ({ postAi: (...a: unknown[]) => postAi(...a) }))
vi.mock('@/components/billing/usePlan', () => ({ usePlan: () => ({ billing: false, loading: false, isPremium: false, usedToday: 0 }), freeAllowanceText: () => 'allowance' }))

import { QuizPlayer } from '@/components/quiz/QuizPlayer'
import { QuizResults } from '@/components/quiz/QuizResults'
import { QuizStartDialog } from '@/components/quiz/QuizStartDialog'
import { ToastProvider } from '@/components/providers/ToastProvider'

const quiz: Quiz = { id: 'qz', note_id: 'n1', title: 'Krebs quiz', created_at: '', questions: [
  { id: 'q1', type: 'mcq', prompt: 'Where?', options: ['Cytoplasm', 'Matrix', 'Nucleus', 'Ribosome'], answer: 'Matrix', explanation: 'In the matrix.' },
  { id: 'q2', type: 'true_false', prompt: 'It makes glucose.', options: null, answer: 'false', explanation: 'It breaks it down.' },
  { id: 'q3', type: 'short', prompt: 'Main product?', options: null, answer: 'NADH', explanation: 'NADH carries electrons.' },
] }
const attempt = (answers: QuizAttempt['answers'] = {}): QuizAttempt => ({ id: 'a1', quiz_id: 'qz', answers, correct: 0, total: 3, started_at: '', finished_at: null })
const done = (answers: QuizAttempt['answers']): QuizAttempt => ({ ...attempt(answers), correct: Object.values(answers).filter(a => a.correct).length, finished_at: 'x' })

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
beforeEach(() => { saveAttempt.mockClear(); finishAttempt.mockClear(); push.mockClear(); postAi.mockReset(); listRecentQuizzes.mockClear(); notes = [{ id: 'n1', title: 'Krebs cycle', course_id: 'c1', updated_at: '' }, { id: 'n2', title: 'Glycolysis', course_id: null, updated_at: '' }] })
afterEach(cleanup)

describe('quiz summary helpers', () => {
  it('letters, percentages and the line that goes with a score', () => {
    expect(['A', 'B', 'C', 'D'].map((_, i) => optionLetter(i))).toEqual(['A', 'B', 'C', 'D'])
    expect(percent(3, 4)).toBe(75); expect(percent(0, 0)).toBe(0)
    expect([[4, 4], [4, 5], [3, 5], [2, 5], [0, 5]].map(([c, t]) => scoreLine(c, t))).toEqual(['Perfect score', 'Great work', 'Good effort', 'Getting there', 'Keep going'])
  })
  it('draws a ring that is empty at 0, full at 100 and clamped beyond', () => {
    const { circumference } = ringDash(0, 50)
    expect(ringDash(0, 50).offset).toBeCloseTo(circumference)
    expect(ringDash(100, 50).offset).toBeCloseTo(0)
    expect(ringDash(50, 50).offset).toBeCloseTo(circumference / 2)
    expect(ringDash(150, 50).offset).toBeCloseTo(0); expect(ringDash(-5, 50).offset).toBeCloseTo(circumference)
  })
  it('finds the missed questions, counting an unanswered one as missed, and spells out True and False', () => {
    expect(missedQuestions(quiz, { answers: { q1: { given: 'Matrix', correct: true, feedback: null }, q2: { given: 'true', correct: false, feedback: null } } }).map(q => q.id)).toEqual(['q2', 'q3'])
    expect(answerText(quiz.questions[1], 'false')).toBe('False'); expect(answerText(quiz.questions[0], 'Matrix')).toBe('Matrix')
  })
})

describe('the quiz player', () => {
  it('shows A to D badges, the question kind, and a running count of right answers', async () => {
    render(<QuizPlayer quiz={quiz} attempt={attempt()} onFinished={vi.fn()} />)
    expect(screen.getByText('Multiple choice')).toBeTruthy()
    expect(screen.getByText('0 correct')).toBeTruthy()
    const tiles = screen.getAllByRole('button').filter(b => /Cytoplasm|Matrix|Nucleus|Ribosome/.test(b.textContent ?? ''))
    expect(tiles.map(t => t.textContent)).toEqual(['ACytoplasm', 'BMatrix', 'CNucleus', 'DRibosome'])
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Matrix' })) })
    expect(screen.getByText('1 correct')).toBeTruthy()
  })

  it('answers with the keys A to D and 1 to 4, then goes on with Enter', async () => {
    render(<QuizPlayer quiz={quiz} attempt={attempt()} onFinished={vi.fn()} />)
    await act(async () => { fireEvent.keyDown(window, { key: 'b' }) }) // Matrix
    expect(screen.getByText('Correct.')).toBeTruthy()
    await act(async () => { fireEvent.keyDown(window, { key: 'a' }) }) // answered already: ignored
    expect(saveAttempt).toHaveBeenCalledTimes(1)
    await act(async () => { fireEvent.keyDown(window, { key: 'Enter' }) })
    expect(screen.getByText('Question 2 of 3')).toBeTruthy()
    await act(async () => { fireEvent.keyDown(window, { key: '2' }) }) // False
    expect(screen.getByText('Correct.')).toBeTruthy()
  })

  it('leaves typing alone: keys in the answer box do not pick an answer or move on', async () => {
    render(<QuizPlayer quiz={quiz} attempt={attempt({ q1: { given: 'Matrix', correct: true, feedback: null }, q2: { given: 'false', correct: true, feedback: null } })} onFinished={vi.fn()} />)
    const box = screen.getByLabelText('Your answer')
    await act(async () => { fireEvent.keyDown(box, { key: 'a' }); fireEvent.keyDown(box, { key: 'Enter' }) })
    expect(saveAttempt).not.toHaveBeenCalled()
    expect(screen.getByText('Question 3 of 3')).toBeTruthy()
  })

  it('marks right and wrong with an icon and words, not colour alone, and colours the progress segments', async () => {
    render(<QuizPlayer quiz={quiz} attempt={attempt()} onFinished={vi.fn()} />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Cytoplasm/ })) })
    expect(screen.getByText('Your answer, not correct')).toBeTruthy()
    expect(screen.getByText('Correct answer')).toBeTruthy()
    expect(screen.getByText(/Not quite\. The answer is Matrix\./)).toBeTruthy()
    const segs = [...screen.getByRole('progressbar', { name: 'Quiz progress' }).children]
    expect(segs[0].className).toContain('bg-danger'); expect(segs[1].className).toContain('bg-line')
  })

  it('finishes from the last question with Enter', async () => {
    const onFinished = vi.fn()
    render(<QuizPlayer quiz={quiz} attempt={attempt({ q1: { given: 'Matrix', correct: true, feedback: null }, q2: { given: 'false', correct: true, feedback: null }, q3: { given: 'nadh', correct: true, feedback: null } })} onFinished={onFinished} />)
    await act(async () => { fireEvent.keyDown(window, { key: 'Enter' }) })
    await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1))
  })
})

describe('the quiz results', () => {
  const answers: QuizAttempt['answers'] = { q1: { given: 'Matrix', correct: true, feedback: null }, q2: { given: 'true', correct: false, feedback: null }, q3: { given: 'nadh', correct: true, feedback: 'Yes.' } }
  const results = (extra: Partial<React.ComponentProps<typeof QuizResults>> = {}) => render(<ToastProvider><QuizResults quiz={quiz} attempt={done(answers)} previous={null} onRetake={vi.fn()} {...extra} /></ToastProvider>)

  it('shows the score as a ring with the fraction, the percentage and a line to match', () => {
    results()
    expect(screen.getByText('2 / 3')).toBeTruthy()
    expect(screen.getByText('67%')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Good effort' })).toBeTruthy()
  })

  it('compares with last time', () => {
    results({ previous: { ...attempt(), correct: 1, total: 3, finished_at: 'x' } })
    expect(screen.getByText(/Last time 1\/3 · up 1/)).toBeTruthy()
  })

  it('reviews every question: the wrong ones open with your answer and the right one, the right ones folded', () => {
    results()
    const items = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    const open = items.map(li => li.querySelector('details')!.open)
    expect(open).toEqual([false, true, false])
    expect(within(items[1]).getByText(/Your answer:/).parentElement!.textContent).toContain('True')
    expect(within(items[1]).getByText('False')).toBeTruthy()
    expect(within(items[1]).getByText('It breaks it down.')).toBeTruthy()
    expect(within(items[1]).getByText(/Wrong\. Question 2\./)).toBeTruthy()
  })

  it('offers to retake just the missed ones, and says so while it starts', async () => {
    let go = () => {}
    const onRetryMissed = vi.fn(() => new Promise<void>(r => { go = r }))
    results({ onRetryMissed })
    fireEvent.click(screen.getByRole('button', { name: 'Retake 1 missed question' }))
    expect(onRetryMissed).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('button', { name: 'Starting…' })).toBeTruthy()
    await act(async () => { go() })
  })

  it('has no retake-missed button for a perfect score, and still offers Retake and Back to note', () => {
    const perfect = { q1: answers.q1, q2: { given: 'false', correct: true, feedback: null }, q3: answers.q3 }
    render(<ToastProvider><QuizResults quiz={quiz} attempt={done(perfect)} previous={null} onRetake={vi.fn()} onRetryMissed={vi.fn()} /></ToastProvider>)
    expect(screen.getByRole('heading', { name: 'Perfect score' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /missed question/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Retake/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Back to note' }).getAttribute('href')).toBe('/notes/n1')
  })
})

describe('the Quiz dialog', () => {
  const open = async () => { await act(async () => { render(<QuizStartDialog open onClose={vi.fn()} />) }) }

  it('lists the notes with their courses, and Start waits until one is chosen', async () => {
    await open()
    const group = screen.getByRole('radiogroup', { name: 'Note' })
    expect(within(group).getAllByRole('radio').map(r => r.textContent)).toEqual(['Krebs cycleBiology', 'Glycolysis'])
    expect((screen.getByRole('button', { name: /Start quiz/ }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(within(group).getByRole('radio', { name: /Krebs cycle/ }))
    expect((screen.getByRole('button', { name: /Start quiz/ }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('starts a quiz on the chosen note with the chosen size and kinds, and opens it', async () => {
    postAi.mockResolvedValue({ ok: true, value: { id: 'new-quiz' } })
    await open()
    fireEvent.click(screen.getByRole('radio', { name: /Glycolysis/ }))
    fireEvent.click(screen.getByRole('radio', { name: '5' }))
    fireEvent.click(screen.getByRole('button', { name: 'Short answer' })) // off
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Start quiz/ })) })
    expect(postAi).toHaveBeenCalledWith('/api/ai/quiz', { noteId: 'n2', count: 5, types: ['mcq', 'true_false'] })
    expect(push).toHaveBeenCalledWith('/quiz/new-quiz')
  })

  it('will not start with no kind of question chosen', async () => {
    await open()
    fireEvent.click(screen.getByRole('radio', { name: /Krebs cycle/ }))
    for (const n of ['Multiple choice', 'True or false', 'Short answer']) fireEvent.click(screen.getByRole('button', { name: n }))
    expect((screen.getByRole('button', { name: /Start quiz/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('says why when a quiz cannot be made, and stays open', async () => {
    postAi.mockResolvedValue({ ok: false, error: 'too_short', message: 'That note is too short to quiz on.' })
    await open()
    fireEvent.click(screen.getByRole('radio', { name: /Krebs cycle/ }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Start quiz/ })) })
    expect(screen.getByText(/too short/)).toBeTruthy()
    expect(push).not.toHaveBeenCalled()
  })

  it('searches a long list of notes, and says when nothing matches', async () => {
    notes = Array.from({ length: 8 }, (_, i) => ({ id: `n${i}`, title: i === 3 ? 'Photosynthesis' : `Note ${i}`, course_id: null, updated_at: '' }))
    await open()
    fireEvent.change(screen.getByLabelText('Search notes'), { target: { value: 'photo' } })
    expect(within(screen.getByRole('radiogroup', { name: 'Note' })).getAllByRole('radio')).toHaveLength(1)
    fireEvent.change(screen.getByLabelText('Search notes'), { target: { value: 'zzz' } })
    expect(screen.getByText(/No note matches/)).toBeTruthy()
  })

  it('invites you to write a note when there are none', async () => {
    notes = []
    await open()
    expect(screen.getByText(/You have no notes yet/)).toBeTruthy()
  })

  it('lists your quizzes with the best score and a way to take them again', async () => {
    listRecentQuizzes.mockResolvedValueOnce([
      { quiz, attempts: 2, best: { correct: 2, total: 3 } },
      { quiz: { ...quiz, id: 'q-new', title: 'Glycolysis quiz' }, attempts: 0, best: null },
    ])
    await open()
    expect(screen.getByText(/best 2\/3/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Retake' }).getAttribute('href')).toBe('/quiz/qz')
    expect(screen.getByText(/not taken/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Take' }).getAttribute('href')).toBe('/quiz/q-new')
  })
})
