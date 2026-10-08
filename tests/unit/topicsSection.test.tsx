// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'
import type { TopicStat } from '@/lib/topics/types'

const stat = (over: Partial<TopicStat>): TopicStat => ({
  topic_id: 't1', name: 'Krebs cycle', position: 1, answers_30d: 0, correct_30d: 0, answers_all: 0, last_practised: null, notes: 1, lectures: 0, decks: 0, status: 'not_started', ...over,
})
let courses = [{ id: 'c1', name: 'Biology', color: '#1D9E75' }, { id: 'c2', name: 'Chemistry', color: '#BA7517' }]
let stats: TopicStat[] = []
let links: { topic_id: string; link: { kind: 'note' | 'lecture' | 'deck'; id: string } }[] = []
let material = { notes: [{ id: 'n1', title: 'Krebs notes' }, { id: 'n2', title: 'Glyco notes' }], lectures: [], decks: [] as { id: string; name: string }[] }
const saveCourseTopics = vi.fn(async (..._a: unknown[]) => {})
const postAi = vi.fn()
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => courses }))
vi.mock('@/lib/data/topics', () => ({
  listTopicStats: async () => stats, listTopicLinks: async () => links, listCourseMaterial: async () => material,
  saveCourseTopics: (...a: unknown[]) => saveCourseTopics(...a),
}))
vi.mock('@/components/ai/aiFetch', async orig => ({ ...(await orig<typeof import('@/components/ai/aiFetch')>()), postAi: (...a: unknown[]) => postAi(...a) }))
import { TopicsSection } from '@/components/progress/TopicsSection'
import { ToastProvider } from '@/components/providers/ToastProvider'

const open = async () => { await act(async () => { render(<ToastProvider><TopicsSection /></ToastProvider>) }) }
beforeEach(() => {
  courses = [{ id: 'c1', name: 'Biology', color: '#1D9E75' }, { id: 'c2', name: 'Chemistry', color: '#BA7517' }]
  stats = []; links = []; material = { notes: [{ id: 'n1', title: 'Krebs notes' }, { id: 'n2', title: 'Glyco notes' }], lectures: [], decks: [] }
  saveCourseTopics.mockClear(); postAi.mockReset()
})
afterEach(cleanup)

describe('Topics section', () => {
  it('a course with no topics offers to draft them', async () => {
    await open()
    expect(screen.getByRole('button', { name: 'Draft topics' })).toBeTruthy()
    expect(screen.queryByText('Weak spots')).toBeNull()
  })
  it('shows each topic with its status, the numbers behind it, and what is linked', async () => {
    stats = [
      stat({ topic_id: 't1', name: 'Krebs cycle', status: 'weak', answers_30d: 12, correct_30d: 8, answers_all: 12, notes: 2, lectures: 1, last_practised: new Date().toISOString() }),
      stat({ topic_id: 't2', name: 'Glycolysis', position: 2, status: 'mastered', answers_30d: 10, correct_30d: 9, answers_all: 10 }),
      stat({ topic_id: 't3', name: 'ETC', position: 3 }),
    ]
    await open()
    const krebs = screen.getByRole('listitem', { name: 'Krebs cycle' })
    expect(krebs.textContent).toContain('Weak')
    expect(krebs.textContent).toContain('12 answers, 67% right in the last 30 days')
    expect(krebs.textContent).toContain('2 notes, 1 lecture, 0 decks')
    expect(screen.getByRole('listitem', { name: 'ETC' }).textContent).toMatch(/Not started.*Not practised yet/)
    expect(screen.getByText('1 of 3 mastered · 1 weak')).toBeTruthy()
  })
  it('puts the weak topic in the weak spots box, or says nothing is weak', async () => {
    stats = [stat({ name: 'Krebs cycle', status: 'weak', answers_30d: 10, correct_30d: 3, answers_all: 10, last_practised: new Date().toISOString() })]
    await open()
    expect(within(screen.getByRole('region', { name: 'Weak spots' })).getByText('Krebs cycle')).toBeTruthy()
    cleanup()
    stats = [stat({ status: 'mastered', answers_30d: 10, correct_30d: 10, answers_all: 10 })]
    await open()
    expect(screen.getByText('Nothing weak right now')).toBeTruthy()
  })
  it('Draft topics asks the AI, shows the draft as unsaved, and saves only when told', async () => {
    postAi.mockResolvedValue({ ok: true, value: { topics: [{ name: 'Krebs cycle', notes: ['n1'], lectures: [] }, { name: 'Glycolysis', notes: ['n2'], lectures: [] }] } })
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Draft topics' })) })
    expect(postAi).toHaveBeenCalledWith('/api/ai/topics', { courseId: 'c1', mode: 'draft' })
    expect(screen.getByRole('status').textContent).toMatch(/Nothing is saved until you press Save/)
    expect(saveCourseTopics).not.toHaveBeenCalled()
    stats = [stat({ name: 'Krebs cycle' }), stat({ topic_id: 't2', name: 'Glycolysis', position: 2 })]
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save topics' })) })
    expect(saveCourseTopics).toHaveBeenCalledWith(expect.anything(), 'c1', [
      { name: 'Krebs cycle', links: [{ kind: 'note', id: 'n1' }] }, { name: 'Glycolysis', links: [{ kind: 'note', id: 'n2' }] },
    ])
    expect(screen.getByText('Topics saved.')).toBeTruthy()
    expect(screen.getByRole('listitem', { name: 'Glycolysis' })).toBeTruthy()
  })
  it('shows the AI\'s refusals in plain words, with no editor', async () => {
    postAi.mockResolvedValue({ ok: false, error: 'too_little', message: 'Add a few more notes or record a lecture in this course first.' })
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Draft topics' })) })
    expect(screen.getByRole('alert').textContent).toMatch(/Add a few more notes/)
    expect(screen.queryByRole('button', { name: 'Save topics' })).toBeNull()
  })
  it('keeps the editor and says so when saving fails', async () => {
    postAi.mockResolvedValue({ ok: true, value: { topics: [{ name: 'Krebs cycle', notes: ['n1'], lectures: [] }] } })
    saveCourseTopics.mockRejectedValueOnce(new Error('rls'))
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Draft topics' })) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save topics' })) })
    expect(screen.getByRole('alert').textContent).toMatch(/Couldn't save/)
    expect(screen.getByLabelText('Topic 1 name')).toBeTruthy()
  })
  it('Update topics appears only when some material is not linked, and adds to the list without losing edits', async () => {
    stats = [stat({ name: 'Krebs cycle' })]
    links = [{ topic_id: 't1', link: { kind: 'note', id: 'n1' } }, { topic_id: 't1', link: { kind: 'note', id: 'n2' } }]
    await open()
    expect(screen.queryByRole('button', { name: 'Update topics' })).toBeNull()
    cleanup()
    links = [{ topic_id: 't1', link: { kind: 'note', id: 'n1' } }]
    postAi.mockResolvedValue({ ok: true, value: { topics: [{ name: 'Pyruvate', notes: ['n2'], lectures: [] }] } })
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Update topics' })) })
    expect(postAi).toHaveBeenCalledWith('/api/ai/topics', { courseId: 'c1', mode: 'update' })
    expect((screen.getByLabelText('Topic 1 name') as HTMLInputElement).value).toBe('Krebs cycle')
    expect((screen.getByLabelText('Topic 2 name') as HTMLInputElement).value).toBe('Pyruvate')
  })
  it('Edit topics opens the saved list; Cancel leaves it as it was', async () => {
    stats = [stat({ name: 'Krebs cycle' })]
    links = [{ topic_id: 't1', link: { kind: 'note', id: 'n1' } }]
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Edit topics' }))
    expect(screen.queryByRole('status')).toBeNull() // not an unsaved AI draft
    fireEvent.change(screen.getByLabelText('Topic 1 name'), { target: { value: 'Changed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('listitem', { name: 'Krebs cycle' })).toBeTruthy()
    expect(saveCourseTopics).not.toHaveBeenCalled()
  })
  it('switching course shows that course\'s topics', async () => {
    await open()
    stats = [stat({ name: 'Bonding' })]
    await act(async () => { fireEvent.change(screen.getByLabelText('Topics course'), { target: { value: 'c2' } }) })
    expect(screen.getByRole('listitem', { name: 'Bonding' })).toBeTruthy()
  })
  it('a student with no courses is pointed at the Planner', async () => {
    courses = []
    await open()
    expect(screen.getByText(/Add a course/)).toBeTruthy()
  })
})
