// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'
import type { Profile } from '@/lib/types'
import type { BoardRow, Friend, SharedByMe, SharedWithMe } from '@/lib/data/friends'

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(search), usePathname: () => '/friends', useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
let search = ''
let friends: Friend[] = [], board: BoardRow[] = [], withMe: SharedWithMe[] = [], byMe: SharedByMe[] = [], shares: { id: string; recipient: string }[] = []
const send = vi.fn(async (..._a: unknown[]): Promise<string> => 'sent'), accept = vi.fn(async (_id: string) => {}), remove = vi.fn(async (_id: string) => {}),
  unshare = vi.fn(async (_id: string) => {}), setShared = vi.fn(async (..._a: unknown[]) => {})
vi.mock('@/lib/data/friends', async orig => ({
  ...(await orig<typeof import('@/lib/data/friends')>()),
  myFriendCode: async () => 'ABCD2345', listFriends: async () => friends, weekBoard: async () => board,
  sharedWithMe: async () => withMe, sharedByMe: async () => byMe, sharesOf: async () => shares,
  sendFriendRequest: (...a: unknown[]) => send(...a), acceptFriendRequest: (_sb: unknown, id: string) => accept(id),
  removeFriendship: (_sb: unknown, id: string) => remove(id), removeShare: (_sb: unknown, id: string) => unshare(id),
  setSharedWith: (...a: unknown[]) => setShared(...a),
}))
import FriendsPage from '@/app/(app)/friends/page'
import { ShareDialog } from '@/components/friends/ShareDialog'
import { ProfileProvider } from '@/components/providers/ProfileProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'
import { ConfirmProvider } from '@/components/providers/ConfirmProvider'
import { FriendCodeError } from '@/lib/data/friends'

const profile = { id: 'me', display_name: 'Ama', timezone: 'UTC', avatar_color: '#3B5BDB', look: 'classic', theme: 'light', accent: 'blue', font: 'sans' } as Profile
const wrap = (ui: React.ReactNode) => <ProfileProvider initial={profile}><ToastProvider><ConfirmProvider>{ui}</ConfirmProvider></ToastProvider></ProfileProvider>
const page = async () => { await act(async () => { render(wrap(<FriendsPage />)) }) }
const friend = (over: Partial<Friend>): Friend => ({ id: 'f1', user_id: 'u1', display_name: 'Kofi', avatar_color: '#0B7A5E', status: 'accepted', incoming: false, since: '2026-10-01T00:00:00Z', ...over })
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  search = ''; friends = []; board = []; withMe = []; byMe = []; shares = []
  for (const f of [send, accept, remove, unshare, setShared]) f.mockClear()
})
afterEach(cleanup)

describe('the Friends page', () => {
  it('ranks this week\'s XP among you and your friends, marking you', async () => {
    friends = [friend({})]
    board = [{ user_id: 'u1', display_name: 'Kofi', avatar_color: '#0B7A5E', xp: 120, is_me: false }, { user_id: 'me', display_name: 'Ama', avatar_color: '#3B5BDB', xp: 80, is_me: true }]
    await page()
    const rows = within(screen.getByRole('list', { name: 'This week\'s XP' })).getAllByRole('listitem').map(r => r.textContent)
    expect(rows).toEqual([expect.stringMatching(/^1.*Kofi.*120 XP$/), expect.stringMatching(/^2.*Ama \(you\).*80 XP$/)])
    expect(screen.getByText('Starts again on Monday')).toBeTruthy()
  })
  it('shows your code, and adds a friend by theirs, saying what happened', async () => {
    await page()
    expect(screen.getByText('ABCD2345')).toBeTruthy()
    send.mockResolvedValueOnce('sent')
    fireEvent.change(screen.getByLabelText('A friend\'s code'), { target: { value: 'wxyz6789' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add friend' })) })
    expect(send).toHaveBeenCalledWith(expect.anything(), 'WXYZ6789')
    expect(screen.getByRole('status').textContent).toMatch(/Request sent/)
    send.mockRejectedValueOnce(new FriendCodeError('No one has that code. Check it and try again.'))
    fireEvent.change(screen.getByLabelText('A friend\'s code'), { target: { value: 'nope' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add friend' })) })
    expect(screen.getByRole('alert').textContent).toBe('No one has that code. Check it and try again.')
  })
  it('an invite link fills in the code', async () => {
    search = 'code=wxyz6789'
    await page()
    expect((screen.getByLabelText('A friend\'s code') as HTMLInputElement).value).toBe('WXYZ6789')
  })
  it('accepts or declines a request, and cancels your own', async () => {
    friends = [friend({ id: 'in', display_name: 'Esi', status: 'pending', incoming: true }), friend({ id: 'out', display_name: 'Yaw', status: 'pending', incoming: false })]
    await page()
    const requests = within(screen.getByRole('region', { name: 'Requests' }))
    await act(async () => { fireEvent.click(requests.getByRole('button', { name: 'Accept' })) })
    expect(accept).toHaveBeenCalledWith('in')
    await act(async () => { fireEvent.click(requests.getByRole('button', { name: 'Cancel' })) })
    expect(remove).toHaveBeenCalledWith('out')
  })
  it('lists what friends shared with you, to open or take off your list, and what you shared, to stop sharing', async () => {
    withMe = [{ id: 's1', kind: 'note', item_id: 'n1', title: 'Krebs cycle', owner_id: 'u1', owner_name: 'Kofi', owner_color: '#0B7A5E', created_at: '2026-10-28T00:00:00Z' }]
    byMe = [{ id: 's2', kind: 'deck', item_id: 'd1', title: 'Cells', recipient_id: 'u1', recipient_name: 'Kofi', created_at: '2026-10-28T00:00:00Z' }]
    await page()
    const mine = within(screen.getByRole('region', { name: 'Shared with you' }))
    expect(mine.getByRole('link', { name: /Krebs cycle.*From Kofi/ }).getAttribute('href')).toBe('/friends/shared/s1')
    await act(async () => { fireEvent.click(mine.getByRole('button', { name: 'Take “Krebs cycle” off your list' })) })
    expect(unshare).toHaveBeenCalledWith('s1')
    await act(async () => { fireEvent.click(within(screen.getByRole('region', { name: 'Shared by you' })).getByRole('button', { name: 'Stop sharing' })) })
    expect(unshare).toHaveBeenCalledWith('s2')
  })
})

describe('sharing a note or deck', () => {
  it('ticks the friends it is shared with already, and saves the new choice', async () => {
    friends = [friend({ user_id: 'u1', display_name: 'Kofi' }), friend({ id: 'f2', user_id: 'u2', display_name: 'Esi' }), friend({ id: 'f3', user_id: 'u3', display_name: 'Asked', status: 'pending' })]
    shares = [{ id: 's1', recipient: 'u1' }]
    await act(async () => { render(wrap(<ShareDialog open onClose={vi.fn()} kind="note" itemId="n1" title="Krebs cycle" />)) })
    expect((screen.getByRole('checkbox', { name: 'Share with Kofi' }) as HTMLInputElement).checked).toBe(true)
    expect(screen.queryByRole('checkbox', { name: 'Share with Asked' })).toBeNull() // only accepted friends
    fireEvent.click(screen.getByRole('checkbox', { name: 'Share with Esi' }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })
    expect(setShared).toHaveBeenCalledWith(expect.anything(), 'note', 'n1', ['u1', 'u2'])
  })
  it('with no friends yet, says how to add one', async () => {
    await act(async () => { render(wrap(<ShareDialog open onClose={vi.fn()} kind="deck" itemId="d1" title="Cells" />)) })
    expect(screen.getByRole('link', { name: 'Add a friend' }).getAttribute('href')).toBe('/friends')
  })
})
