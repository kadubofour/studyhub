// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'

const chat: Record<string, unknown> = { id: 'c1', title: 'Krebs', course_id: null, note_id: null, lecture_id: null, guided: false, created_at: '', updated_at: '' }
let messages: Record<string, unknown>[] = []
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => [] }))
vi.mock('@/lib/data/notes', () => ({ listNotes: async () => [] }))
vi.mock('@/lib/data/lectures', () => ({ listLectures: async () => [] }))
vi.mock('@/lib/data/tutor', () => ({
  getChat: async () => ({ ...chat }), listMessages: async () => messages, renameChat: vi.fn(),
  setChatCourse: vi.fn(), setChatGuided: vi.fn(), deleteChat: vi.fn(), saveProposals: vi.fn(), setChatContext: vi.fn(),
}))
vi.mock('@/lib/tutor/apply', () => ({ applyProposal: vi.fn() }))
vi.mock('@/components/billing/usePlan', async orig => ({ ...(await orig<object>()), usePlan: () => ({ billing: false, isPremium: false, loading: false, tutorToday: 0 }) }))
let send: (chatId: string, message: string, signal?: AbortSignal) => Promise<unknown>
vi.mock('@/lib/tutor/stream', () => ({ sendTutorMessage: (c: string, m: string, s?: AbortSignal) => send(c, m, s) }))
const router = { push: vi.fn(), replace: vi.fn() }
vi.mock('next/navigation', () => ({ useRouter: () => router, useSearchParams: () => new URLSearchParams('') }))
let profileName: string | null = 'Kwadwo'
vi.mock('@/components/providers/ProfileProvider', () => ({ useProfile: () => ({ profile: { display_name: profileName } }) }))
import { ChatView } from '@/components/tutor/ChatView'
import { ConfirmProvider } from '@/components/providers/ConfirmProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'


const open = async () => { await act(async () => { render(<ToastProvider><ConfirmProvider><ChatView chatId="c1" /></ConfirmProvider></ToastProvider>) }) }
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  messages = []
  window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia // a phone
})
afterEach(() => { cleanup(); delete (window as { matchMedia?: unknown }).matchMedia })

describe('a chat on a phone', () => {
  it('has a bar with the way back and one ⋯ menu, not a row of buttons', async () => {
    await open()
    expect(screen.getByRole('link', { name: 'Back to the Tutor' }).getAttribute('href')).toBe('/tutor')
    expect(screen.queryByRole('button', { name: 'Rename' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete chat' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Chat options' }))
    const menu = within(screen.getByRole('menu'))
    for (const name of ['Voice chat', 'Rename', 'Guided', 'Choose a note or lecture', 'Delete chat']) expect(menu.getByRole('menuitem', { name })).toBeTruthy()
  })
  it('keeps the Guided switch in that menu, not beside the message', async () => {
    await open()
    expect(screen.queryByRole('switch', { name: 'Guided' })?.closest('span')?.className ?? '').toContain('max-md:hidden')
  })
  it('starts an empty chat with ideas as tiles that put a message in the box', async () => {
    await open()
    const tiles = within(screen.getByRole('list', { name: 'Ideas to start with' }))
    fireEvent.click(tiles.getAllByRole('button')[0])
    expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value.length).toBeGreaterThan(0)
  })
})
