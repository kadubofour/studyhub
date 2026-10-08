// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'

const push = vi.fn()
let existing: { id: string } | null = null
const createChat = vi.fn(async (..._a: unknown[]) => ({ id: 'new1' }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/tutor', () => ({ findChat: async () => existing, createChat: (...a: unknown[]) => createChat(...a) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
import { AskTutorButton } from '@/components/tutor/AskTutorButton'

afterEach(() => { cleanup(); existing = null; push.mockClear(); createChat.mockClear() })
const click = async () => { await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Ask the tutor' })) }) }

describe('AskTutorButton', () => {
  it('opens a new chat about the note, in its course, named after it', async () => {
    render(<AskTutorButton target={{ note_id: 'n1' }} title="Krebs cycle" courseId="c1" />)
    await click()
    expect(createChat).toHaveBeenCalledWith(expect.anything(), { title: 'Krebs cycle', note_id: 'n1', course_id: 'c1' })
    expect(push).toHaveBeenCalledWith('/tutor/new1')
  })
  it('reopens the existing chat about it instead of starting another', async () => {
    existing = { id: 'old1' }
    render(<AskTutorButton target={{ lecture_id: 'l1' }} title="Bio" courseId={null} />)
    await click()
    expect(createChat).not.toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith('/tutor/old1')
  })
})
