// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'

let chats: Record<string, unknown>[] = []
const push = vi.fn()
const createChat = vi.fn(async (..._a: unknown[]) => ({ id: 'c9' }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => [{ id: 'k1', name: 'Biology', color: '#1D9E75' }] }))
vi.mock('@/lib/data/tutor', () => ({ listChats: async () => chats, createChat: (...a: unknown[]) => createChat(...a) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
import TutorPage from '@/app/(app)/tutor/page'

afterEach(() => { cleanup(); chats = []; push.mockClear(); createChat.mockClear() })
const open = async () => { await act(async () => { render(<TutorPage />) }) }

describe('Tutor page', () => {
  it('lists chats as links', async () => {
    chats = [{ id: 'c1', title: 'Krebs cycle', course_id: 'k1', updated_at: '2026-10-03T09:00:00Z' }]
    await open()
    expect(screen.getByRole('link', { name: /Krebs cycle/ }).getAttribute('href')).toBe('/tutor/c1')
    expect(screen.getByText('Biology')).toBeTruthy()
  })
  it('says there are no chats yet', async () => {
    await open()
    expect(screen.getByText(/No chats yet/)).toBeTruthy()
  })
  it('starts a new chat and opens it', async () => {
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'New chat' })) })
    expect(createChat).toHaveBeenCalledWith(expect.anything(), {})
    expect(push).toHaveBeenCalledWith('/tutor/c9')
  })
})
