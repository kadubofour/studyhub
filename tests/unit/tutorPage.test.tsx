// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'

let chats: Record<string, unknown>[] = []
let contexts: Record<string, unknown> = {}
let contextsFail = false
const push = vi.fn()
const createChat = vi.fn(async (..._a: unknown[]) => ({ id: 'c9' }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => [{ id: 'k1', name: 'Biology', color: '#1D9E75' }, { id: 'k2', name: 'Chemistry', color: '#BA7517' }] }))
vi.mock('@/lib/data/notes', () => ({ listNotes: async () => [{ id: 'n1', title: 'Krebs cycle', course_id: 'k1' }] }))
vi.mock('@/lib/data/lectures', () => ({ listLectures: async () => [{ id: 'l1', title: 'Week 3', course_id: 'k1' }] }))
vi.mock('@/lib/data/tutor', () => ({
  listChats: async () => chats, createChat: (...a: unknown[]) => createChat(...a),
  listChatContexts: async () => { if (contextsFail) throw new Error('offline'); return contexts },
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
import TutorPage from '@/app/(app)/tutor/page'

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
afterEach(() => { cleanup(); chats = []; contexts = {}; contextsFail = false; push.mockClear(); createChat.mockClear() })
const open = async () => { await act(async () => { render(<TutorPage />) }) }
const chat = (id: string, title: string, over: Record<string, unknown> = {}) => ({ id, title, course_id: null, note_id: null, lecture_id: null, updated_at: '2026-10-03T09:00:00Z', ...over })

describe('Tutor page', () => {
  it('lists chats as links, with the course and what each is about', async () => {
    chats = [chat('c1', 'Krebs cycle', { course_id: 'k1', note_id: 'n1' })]
    contexts = { c1: { kind: 'note', title: 'Krebs cycle notes' } }
    await open()
    const link = screen.getByRole('link', { name: /Krebs cycle/ })
    expect(link.getAttribute('href')).toBe('/tutor/c1')
    expect(link.textContent).toContain('Note: Krebs cycle notes')
    expect(link.textContent).toContain('Biology')
  })

  it('still lists the chats when what they are about cannot be loaded', async () => {
    chats = [chat('c1', 'Krebs cycle')]
    contextsFail = true
    await open()
    expect(screen.getByRole('link', { name: /Krebs cycle/ })).toBeTruthy()
  })

  it('says there are no chats yet', async () => {
    await open()
    expect(screen.getByText(/No chats yet/)).toBeTruthy()
    expect(screen.queryByLabelText('Search chats')).toBeNull() // nothing to search
  })

  it('starts a new chat and opens it', async () => {
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'New chat' })) })
    expect(createChat).toHaveBeenCalledWith(expect.anything(), {})
    expect(push).toHaveBeenCalledWith('/tutor/c9')
  })

  it('stays put, and says so, when a chat cannot be started', async () => {
    createChat.mockRejectedValueOnce(new Error('offline'))
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'New chat' })) })
    expect(push).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toMatch(/Couldn.t start a chat/)
  })

  it('searches chats by title or by what they are about, and filters by course', async () => {
    chats = [chat('c1', 'Krebs cycle', { course_id: 'k1' }), chat('c2', 'Reactions', { course_id: 'k2', updated_at: '2026-10-04T09:00:00Z' }), chat('c3', 'New chat', { note_id: 'n1', updated_at: '2026-10-02T09:00:00Z' })]
    contexts = { c3: { kind: 'note', title: 'Glycolysis' } }
    await open()
    const names = () => screen.getAllByRole('link').map(l => l.getAttribute('href'))
    expect(names()).toEqual(['/tutor/c2', '/tutor/c1', '/tutor/c3']) // newest first
    fireEvent.change(screen.getByLabelText('Search chats'), { target: { value: 'glyco' } })
    expect(names()).toEqual(['/tutor/c3'])
    fireEvent.change(screen.getByLabelText('Search chats'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Chemistry' }))
    expect(names()).toEqual(['/tutor/c2'])
    fireEvent.change(screen.getByLabelText('Search chats'), { target: { value: 'zzz' } })
    expect(screen.getByText('No chats match.')).toBeTruthy()
  })

  it('shows the four ways to start, and a starter asks what it is about before it opens a chat with its message ready', async () => {
    await open()
    const ways = within(screen.getByRole('region', { name: 'Ways to start' }))
    expect(ways.getAllByRole('button').map(b => b.querySelector('span:nth-of-type(2)')?.textContent)).toEqual(['Explain a topic', 'Quiz me', 'Plan my revision', 'Summarise my notes'])
    await act(async () => { fireEvent.click(ways.getByRole('button', { name: /Quiz me/ })) })
    await act(async () => { fireEvent.click(within(screen.getByRole('list', { name: 'Notes' })).getByRole('button', { name: /Krebs cycle/ })) })
    expect(createChat).toHaveBeenCalledWith(expect.anything(), { title: 'Krebs cycle', course_id: 'k1', note_id: 'n1' })
    expect(push).toHaveBeenCalledWith(`/tutor/c9?ask=${encodeURIComponent('Quiz me on Krebs cycle')}`)
  })

  it('"Chat about…" opens a chat with that lecture or course attached and nothing to send', async () => {
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Chat about…' })) })
    fireEvent.click(screen.getByRole('radio', { name: 'Lectures' }))
    await act(async () => { fireEvent.click(within(screen.getByRole('list', { name: 'Lectures' })).getByRole('button', { name: /Week 3/ })) })
    expect(createChat).toHaveBeenLastCalledWith(expect.anything(), { title: 'Week 3', course_id: 'k1', lecture_id: 'l1' })
    expect(push).toHaveBeenLastCalledWith('/tutor/c9')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Chat about…' })) })
    fireEvent.click(screen.getByRole('radio', { name: 'Courses' }))
    await act(async () => { fireEvent.click(within(screen.getByRole('list', { name: 'Courses' })).getByRole('button', { name: 'Chemistry' })) })
    expect(createChat).toHaveBeenLastCalledWith(expect.anything(), { title: 'Chemistry', course_id: 'k2' })
  })

  it('a starter can be used without choosing anything: its message is ready to finish', async () => {
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Explain a topic/ })) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Without a note or lecture' })) })
    expect(createChat).toHaveBeenCalledWith(expect.anything(), {})
    expect(push).toHaveBeenCalledWith(`/tutor/c9?ask=${encodeURIComponent('Explain this topic to me in plain words: ')}`)
  })
  it('"Chat about…" has no skip: it is for choosing', async () => {
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Chat about…' })) })
    expect(screen.queryByRole('button', { name: 'Without a note or lecture' })).toBeNull()
  })
  it('does not say the course twice', async () => {
    chats = [chat('c1', 'Krebs cycle', { course_id: 'k1' })]
    await open()
    expect(screen.getAllByText('Biology')).toHaveLength(1) // once, beside the chat (the course chips appear only when more than one course has chats)
    expect(screen.queryByText('Course: Biology')).toBeNull()
  })
})
