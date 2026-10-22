// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'

let chats: Record<string, unknown>[] = []
const requestUpload = vi.fn()
vi.mock('@/lib/scan/events', () => ({ requestUpload: (...a: unknown[]) => requestUpload(...a) }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => [] }))
vi.mock('@/lib/data/notes', () => ({ listNotes: async () => [{ id: 'n1', title: 'Krebs cycle', course_id: null }] }))
vi.mock('@/lib/data/lectures', () => ({ listLectures: async () => [] }))
vi.mock('@/lib/data/tutor', () => ({ listChats: async () => chats, createChat: async () => ({ id: 'c9' }), listChatContexts: async () => ({}) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
import TutorPage from '@/app/(app)/tutor/page'

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
afterEach(() => { cleanup(); chats = []; requestUpload.mockClear() })
const open = async () => { await act(async () => { render(<TutorPage />) }) }
const chat = (id: string, title: string) => ({ id, title, course_id: null, note_id: null, lecture_id: null, updated_at: '2026-10-03T09:00:00Z' })

describe('uploading from the Tutor page', () => {
  it('has an Upload button beside the chat search, which opens Upload set to lead to a chat', async () => {
    chats = [chat('c1', 'Krebs cycle')]
    await open()
    const row = screen.getByLabelText('Search chats').closest('[data-testid="chat-search-row"]') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: 'Upload' }))
    expect(requestUpload).toHaveBeenCalledWith({ next: 'tutor' })
  })
  it('is there before the first chat too, when there is nothing to search yet', async () => {
    await open()
    expect(screen.queryByLabelText('Search chats')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }))
    expect(requestUpload).toHaveBeenCalledWith({ next: 'tutor' })
  })
  it('is also in the Chat about picker, which closes so the upload dialog is not underneath it', async () => {
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Chat about…' })) })
    const picker = screen.getByRole('dialog', { name: 'Chat about…' })
    await act(async () => { fireEvent.click(within(picker).getByRole('button', { name: 'Upload' })) })
    expect(requestUpload).toHaveBeenCalledWith({ next: 'tutor' })
    expect(document.querySelector('dialog')!.hasAttribute('open')).toBe(false)
  })
  it('the starter pickers have it too, because they also search your material', async () => {
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Quiz me/ })) })
    await act(async () => { fireEvent.click(within(screen.getByRole('dialog', { name: 'Quiz me' })).getByRole('button', { name: 'Upload' })) })
    expect(requestUpload).toHaveBeenCalledWith({ next: 'tutor' })
  })
})
