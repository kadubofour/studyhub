// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'
import type { Profile } from '@/lib/types'

type Hub = { quizzes: unknown[]; attempts: unknown[]; notes: unknown[]; courses: unknown[] }
const listQuizHub = vi.fn<() => Promise<Hub>>()
const deleteQuiz = vi.fn(async (..._a: unknown[]) => {})
vi.mock('@/lib/data/quizzes', () => ({ listQuizHub: () => listQuizHub(), deleteQuiz: (...a: unknown[]) => deleteQuiz(...a) }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))

import { ProfileProvider } from '@/components/providers/ProfileProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'
import { ConfirmProvider } from '@/components/providers/ConfirmProvider'
import QuizHubPage from '@/app/(app)/quiz/page'
import { announceProgressChanged } from '@/lib/xp/events'

const profile: Profile = {
  id: 'u', display_name: 'Ama', school: null, programme: null, avatar_color: '#3B5BDB', timezone: 'UTC', daily_goal_minutes: 120, focus_minutes: 25,
  short_break_minutes: 5, long_break_minutes: 15, long_break_every: 4, default_editor_mode: 'rich',
  theme: 'system', accent: 'blue', font: 'sans', look: 'classic', content_width: 'wide', auto_math: true, onboarded: true, friend_code: 'ABCD2345', show_on_boards: true,
}
const quiz = (id: string, note_id: string, title: string) => ({ id, note_id, title, created_at: '2026-10-01T00:00:00Z', questions: [{ id: 'x' }] })
const hub = (over: Partial<Hub> = {}): Hub => ({
  quizzes: [quiz('a', 'n1', 'Cells quiz'), quiz('b', 'n2', 'Loose quiz')],
  attempts: [{ id: '1', quiz_id: 'a', correct: 1, total: 4, finished_at: '2026-10-10T10:00:00Z' }],
  notes: [{ id: 'n1', title: 'Cells', course_id: 'c1' }, { id: 'n2', title: 'Loose', course_id: null }],
  courses: [{ id: 'c1', name: 'Biology', color: '#2f9e44' }], ...over,
})
const mount = () => render(<ProfileProvider initial={profile}><ToastProvider><ConfirmProvider><QuizHubPage /></ConfirmProvider></ToastProvider></ProfileProvider>)

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  listQuizHub.mockReset().mockResolvedValue(hub()); deleteQuiz.mockClear()
})
afterEach(cleanup)
const inList = () => within(screen.getByRole('region', { name: 'All quizzes' })) // a low score also shows under "Worth another go"

describe('the Quiz page', () => {
  it('words one score as one score', async () => {
    await act(async () => { mount() })
    expect(screen.getByRole('img', { name: 'Your last score: 25%' })).toBeTruthy()
  })

  it('does not keep a course filter that no longer has any quizzes, and says what the filter is', async () => {
    await act(async () => { mount() })
    fireEvent.change(screen.getByLabelText('Course'), { target: { value: 'c1' } })
    expect(screen.queryByText('Loose quiz')).toBeNull()
    // The Biology quiz is deleted: the filter must not leave the page empty with nothing to undo it
    listQuizHub.mockResolvedValue(hub({ quizzes: [quiz('b', 'n2', 'Loose quiz')], attempts: [] }))
    await act(async () => { announceProgressChanged() })
    expect(screen.getByText('Loose quiz')).toBeTruthy()
  })

  it('offers "No course" only when some quiz has none', async () => {
    await act(async () => { mount() })
    expect(within(screen.getByLabelText('Course')).getByRole('option', { name: 'No course' })).toBeTruthy()
    cleanup()
    listQuizHub.mockResolvedValue(hub({ quizzes: [quiz('a', 'n1', 'Cells quiz')] }))
    await act(async () => { mount() })
    expect(within(screen.getByLabelText('Course')).queryByRole('option', { name: 'No course' })).toBeNull()
  })

  it('an older answer that arrives late does not bring back what was just deleted', async () => {
    await act(async () => { mount() })
    let late: (h: Hub) => void = () => {}
    listQuizHub.mockImplementationOnce(() => new Promise(r => { late = r })) // a load that is slow...
    await act(async () => { announceProgressChanged() })
    listQuizHub.mockResolvedValue(hub({ quizzes: [quiz('b', 'n2', 'Loose quiz')], attempts: [] })) // ...then a newer one that is quick
    await act(async () => { announceProgressChanged() })
    expect(screen.queryByText('Cells quiz')).toBeNull()
    await act(async () => { late(hub()) }) // the slow one finishes last, with the old list
    expect(screen.queryByText('Cells quiz')).toBeNull()
  })

  it('asks before deleting, and says what else goes with the quiz', async () => {
    await act(async () => { mount() })
    fireEvent.click(screen.getByRole('button', { name: 'Delete Cells quiz' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toContain('XP')
    expect(deleteQuiz).not.toHaveBeenCalled()
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' })) })
    expect(deleteQuiz).toHaveBeenCalledWith({}, 'a')
    expect(screen.queryByText('Cells quiz')).toBeNull()
  })

  it('says so, and keeps the quiz, when deleting fails', async () => {
    deleteQuiz.mockRejectedValueOnce(new Error('offline'))
    await act(async () => { mount() })
    fireEvent.click(screen.getByRole('button', { name: 'Delete Cells quiz' }))
    const dialog = await screen.findByRole('dialog')
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' })) })
    expect(screen.getByText('Couldn\'t delete that quiz.')).toBeTruthy()
    expect(inList().getByText('Cells quiz')).toBeTruthy()
  })

  it('offers another try when the first load fails', async () => {
    listQuizHub.mockRejectedValueOnce(new Error('offline'))
    await act(async () => { mount() })
    expect(screen.getByRole('alert').textContent).toContain('Couldn')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Try again' })) })
    expect(inList().getByText('Cells quiz')).toBeTruthy()
  })
})
