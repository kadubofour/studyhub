// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react'
import type { Course } from '@/lib/types'

let stats: object[]
let statsFails = false
const postAi = vi.fn()
const saveCourseTopics = vi.fn(async (..._a: unknown[]) => {})
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/components/ai/aiFetch', () => ({ postAi: (...a: unknown[]) => postAi(...a), AI_USED: 'ai-used', AI_MESSAGES: {} }))
vi.mock('@/lib/data/topics', () => ({
  listTopicStats: async () => { if (statsFails) throw new Error('offline'); return stats },
  listCourseMaterial: async () => ({ notes: [{ id: 'n1', title: 'Krebs notes' }], lectures: [], decks: [], files: [{ id: 'f1', name: 'Sets slides.pdf' }] }),
  saveCourseTopics: (...a: unknown[]) => saveCourseTopics(...a),
}))
import { PlanCourseFlow } from '@/components/plan/PlanCourseFlow'

afterEach(cleanup)
const course: Course = { id: 'c1', name: 'Biology', color: '#1D9E75' }
const onSave = vi.fn(), onCancel = vi.fn()
const open = async () => { await act(async () => { render(<PlanCourseFlow course={course} exams={[{ id: 'e1', title: 'Midterm' }]} initialExamId="e1" saving={false} error={null} onSave={onSave} onCancel={onCancel} />) }) }
beforeEach(() => {
  stats = []; statsFails = false; postAi.mockReset(); saveCourseTopics.mockClear(); onSave.mockClear(); onCancel.mockClear()
  postAi.mockResolvedValue({ ok: true, value: { topics: [{ name: 'Krebs cycle', notes: ['n1'], lectures: [], files: [] }, { name: 'Sets', notes: [], lectures: [], files: ['f1'] }] } })
})

describe('PlanCourseFlow', () => {
  it('goes straight to the plan\'s settings when the course already has topics, finding nothing', async () => {
    stats = [{ topic_id: 't1' }]
    await open()
    expect(screen.getByRole('button', { name: 'Save plan' })).toBeTruthy()
    expect(postAi).not.toHaveBeenCalled()
  })
  it('finds the topics when there are none, shows them to check, and goes on to the settings once they are saved', async () => {
    await open()
    expect(postAi).toHaveBeenCalledWith('/api/ai/topics', { courseId: 'c1', mode: 'draft' })
    expect((screen.getByLabelText('Topic 1 name') as HTMLInputElement).value).toBe('Krebs cycle')
    expect((screen.getByLabelText('Topic 2 name') as HTMLInputElement).value).toBe('Sets')
    expect(screen.getByRole('button', { name: 'Remove Sets slides.pdf from Sets' })).toBeTruthy() // the file the topic was found in
    expect(saveCourseTopics).not.toHaveBeenCalled() // nothing is kept before Save
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save topics' })) })
    expect(saveCourseTopics).toHaveBeenCalledWith(expect.anything(), 'c1', [
      { name: 'Krebs cycle', links: [{ kind: 'note', id: 'n1' }] }, { name: 'Sets', links: [{ kind: 'file', id: 'f1' }] },
    ])
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save plan' })) })
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ examId: 'e1', mode: 'balanced' }))
  })
  it('lets the student change the topics before saving them', async () => {
    await open()
    fireEvent.change(screen.getByLabelText('Topic 1 name'), { target: { value: 'Krebs and friends' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save topics' })) })
    expect((saveCourseTopics.mock.calls[0][2] as { name: string }[])[0].name).toBe('Krebs and friends')
  })
  it('cancelling the topics keeps nothing and closes the flow', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
    expect(saveCourseTopics).not.toHaveBeenCalled()
  })
  it('says what to add when the course has too little to find topics in', async () => {
    postAi.mockResolvedValue({ ok: false, error: 'too_little', message: 'x' })
    await open()
    expect(screen.getByRole('alert').textContent).toMatch(/at least two notes, lectures or files/)
    expect(screen.getByRole('link', { name: 'Open Library' }).getAttribute('href')).toBe('/library')
  })
  it('shows another failure in words and tries again', async () => {
    postAi.mockResolvedValueOnce({ ok: false, error: 'busy', message: 'Couldn\'t reach the AI. Try again.' })
    await open()
    expect(screen.getByRole('alert').textContent).toContain('Couldn\'t reach the AI')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Try again' })) })
    await waitFor(() => expect(screen.getByLabelText('Topic 1 name')).toBeTruthy())
    expect(postAi).toHaveBeenCalledTimes(2)
  })
  it('does not draft over topics it could not read', async () => {
    statsFails = true
    await open()
    expect(postAi).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toMatch(/Couldn't load this course/)
  })
  it('keeps the topics and says so when they cannot be saved', async () => {
    saveCourseTopics.mockRejectedValueOnce(new Error('x'))
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save topics' })) })
    expect(screen.getByRole('alert').textContent).toMatch(/Couldn't save/)
    expect(screen.queryByRole('button', { name: 'Save plan' })).toBeNull()
  })
})
