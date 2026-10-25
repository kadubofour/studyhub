// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, act, within, fireEvent } from '@testing-library/react'
import type { Profile } from '@/lib/types'
import type { BoardRow } from '@/lib/social/rank'

vi.mock('next/navigation', () => ({ usePathname: () => '/leaderboard', useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), useSearchParams: () => new URLSearchParams() }))
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }) }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))

let board: BoardRow[] = []
let requests: { from_id: string; display_name: string | null; avatar_color: string; created_at: string }[] = []
let friends: { user_id: string; display_name: string | null; avatar_color: string }[] = []
const leaderboard = vi.fn(async () => board)
const respondFriendRequest = vi.fn<(sb: unknown, from: string, accept: boolean) => Promise<void>>(async () => {})
vi.mock('@/lib/data/social', () => ({
  leaderboard: () => leaderboard(),
  myFriends: async () => friends,
  myFriendRequests: async () => requests,
  myGroups: async () => [],
  groupMembersOf: async () => [],
  respondFriendRequest: (_sb: unknown, from: string, accept: boolean) => respondFriendRequest(_sb, from, accept),
  sendFriendRequest: vi.fn(), redeemInPerson: vi.fn(), removeFriend: vi.fn(), newFriendCode: vi.fn(), startInPerson: vi.fn(),
  createGroup: vi.fn(), joinGroup: vi.fn(), leaveGroup: vi.fn(), renameGroup: vi.fn(), removeMember: vi.fn(), newGroupInvite: vi.fn(), deleteGroup: vi.fn(),
}))
const updateProfile = vi.fn(async () => ({}))
vi.mock('@/lib/data/profile', () => ({ updateProfile: (...a: unknown[]) => updateProfile(...(a as [])) }))

import { ProfileProvider } from '@/components/providers/ProfileProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'
import { ConfirmProvider } from '@/components/providers/ConfirmProvider'
import LeaderboardPage from '@/app/(app)/leaderboard/page'
import { PrivacyCard } from '@/components/settings/PrivacyCard'

const profile = { id: 'me', display_name: 'Kwadwo', avatar_color: '#1D9E75', friend_code: 'ABCD2345', show_on_boards: true, timezone: 'UTC', theme: 'light', accent: 'blue', font: 'sans', look: 'studio' } as Profile
const wrap = (ui: React.ReactNode) => <ProfileProvider initial={profile}><ToastProvider><ConfirmProvider>{ui}</ConfirmProvider></ToastProvider></ProfileProvider>
const open = async () => { await act(async () => { render(wrap(<LeaderboardPage />)) }) }
const row = (id: string, name: string, week_xp: number, total_xp: number, streak = 0): BoardRow =>
  ({ user_id: id, display_name: name, avatar_color: '#BA7517', week_xp, total_xp, streak, is_me: id === 'me' })
const names = () => within(screen.getByRole('list', { name: 'Friends board' })).getAllByRole('listitem').map(li => li.querySelector('[data-name]')!.textContent)

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  board = [row('me', 'Kwadwo', 50, 500, 2), row('ama', 'Ama', 120, 100, 1), row('kofi', 'Kofi', 80, 900, 4)]
  friends = [{ user_id: 'ama', display_name: 'Ama', avatar_color: '#BA7517' }, { user_id: 'kofi', display_name: 'Kofi', avatar_color: '#BA7517' }]
  requests = []
  leaderboard.mockClear(); respondFriendRequest.mockClear(); updateProfile.mockClear()
})
afterEach(cleanup)

describe('the Leaderboard page', () => {
  it('lists the friends board in week order with my row marked You', async () => {
    await open()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Leaderboard')
    expect(screen.getByRole('button', { name: 'Friends' }).getAttribute('aria-pressed')).toBe('true')
    expect(names()).toEqual(['Ama', 'Kofi', 'Kwadwo'])
    const items = within(screen.getByRole('list', { name: 'Friends board' })).getAllByRole('listitem')
    expect(within(items[2]).getByText('You')).toBeTruthy()
    expect(within(items[0]).queryByText('You')).toBeNull()
    expect(items[0].textContent).toContain('120 XP')
  })
  it('switching to All time re-sorts', async () => {
    await open()
    expect(screen.getByRole('radio', { name: 'This week' }).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByRole('radio', { name: 'All time' }))
    expect(names()).toEqual(['Kofi', 'Kwadwo', 'Ama'])
    expect(within(screen.getByRole('list', { name: 'Friends board' })).getAllByRole('listitem')[0].textContent).toContain('900 XP')
  })
  it('a request can be accepted from the page', async () => {
    requests = [{ from_id: 'esi', display_name: 'Esi', avatar_color: '#123456', created_at: '2026-10-25T00:00:00Z' }]
    await open()
    const box = within(screen.getByRole('region', { name: 'Friend requests' }))
    expect(box.getByText('Esi')).toBeTruthy()
    const before = leaderboard.mock.calls.length
    requests = []
    await act(async () => { fireEvent.click(box.getByRole('button', { name: 'Accept Esi' })) })
    expect(respondFriendRequest).toHaveBeenCalledWith(expect.anything(), 'esi', true)
    expect(leaderboard.mock.calls.length).toBeGreaterThan(before)
    expect(screen.queryByRole('region', { name: 'Friend requests' })).toBeNull()
  })
  it('shows my friend code, and an empty board invites me to add my first friend', async () => {
    board = [row('me', 'Kwadwo', 0, 0)]
    friends = []
    await open()
    expect(screen.getByRole('heading', { name: 'Add your first friend' })).toBeTruthy()
    expect(screen.getAllByText('ABCD2345').length).toBeGreaterThan(0)
  })
})

describe('the nav', () => {
  it('nav has Leaderboard after Progress', async () => {
    const { PLACES } = await import('@/lib/shell/nav')
    const { Trophy } = await import('lucide-react')
    const i = PLACES.findIndex(p => p.href === '/progress')
    expect(PLACES[i + 1]).toMatchObject({ href: '/leaderboard', label: 'Leaderboard', icon: Trophy })
  })
})

describe('Settings: Privacy', () => {
  it('turning off Show me on leaderboards saves show_on_boards', async () => {
    await act(async () => { render(wrap(<PrivacyCard />)) })
    const sw = screen.getByRole('switch', { name: 'Show me on leaderboards' })
    expect(sw.getAttribute('aria-checked')).toBe('true')
    await act(async () => { fireEvent.click(sw) })
    expect(updateProfile).toHaveBeenCalledWith(expect.anything(), 'me', { show_on_boards: false })
    expect(sw.getAttribute('aria-checked')).toBe('false')
  })
})
