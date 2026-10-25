// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'

vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
type F = { user_id: string; display_name: string | null; avatar_color: string }
let friends: F[] = []
let requests: { from_id: string; display_name: string | null; avatar_color: string; created_at: string }[] = []
vi.mock('@/lib/data/social', () => ({
  startInPerson: async () => ({ code: '123456', expires_at: new Date(Date.now() + 5 * 60_000).toISOString() }),
  myFriends: async () => friends,
  myFriendRequests: async () => requests,
  redeemInPerson: vi.fn(),
}))

import { ToastProvider } from '@/components/providers/ToastProvider'
import { InPersonDialog } from '@/components/social/InPersonDialog'

const f = (id: string): F => ({ user_id: id, display_name: id, avatar_color: '#123456' })
const onFriends = vi.fn()
const onClose = vi.fn()
const open = async () => {
  await act(async () => { render(<ToastProvider><InPersonDialog onClose={onClose} onFriends={onFriends} /></ToastProvider>) })
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })
}
const wait = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }

beforeEach(() => {
  vi.useFakeTimers()
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  friends = [f('ama')]; requests = []
  onFriends.mockClear(); onClose.mockClear()
})
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('Add in person', () => {
  it('the countdown is not a live region; only running out is announced', async () => {
    await open()
    expect(screen.getByLabelText('Your in-person code').textContent).toBe('123456')
    const ticking = screen.getByText(/Works for/)
    expect(ticking.closest('[aria-live], [role="status"], output')).toBeNull()
    const status = screen.getByTestId('code-status')
    expect(status.getAttribute('role')).toBe('status')
    expect(status.textContent).toBe('')
    await wait(60_000)
    expect(status.textContent).toBe('')
    await wait(4 * 60_000 + 1000)
    expect(screen.getByTestId('code-status').textContent).toBe('That code has run out.')
    expect(screen.getByRole('button', { name: 'New code' })).toBeTruthy()
  })
  it('a new friend from an older request is not taken as the code being used', async () => {
    requests = [{ from_id: 'esi', display_name: 'Esi', avatar_color: '#123456', created_at: '2026-10-25T00:00:00Z' }]
    await open()
    friends = [f('ama'), f('esi')] // accepted elsewhere while the code shows
    await wait(3500)
    expect(onFriends).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
  it('a new user in the friends list means the code was used, even if the list did not get longer', async () => {
    await open()
    friends = [f('kofi')] // ama removed elsewhere, kofi used the code
    await wait(3500)
    expect(onFriends).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
})
