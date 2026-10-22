// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, act, within } from '@testing-library/react'
import type { Profile } from '@/lib/types'
import { createTimer } from '@/lib/timer'

vi.mock('next/navigation', () => ({ usePathname: () => '/home', useRouter: () => ({ push: vi.fn() }) }))
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }) }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/components/providers/FocusProvider', async orig => ({
  ...(await orig<typeof import('@/components/providers/FocusProvider')>()),
  useFocus: () => ({ timer: createTimer('focus', 25 * 60_000), now: 0, todayMinutes: 30, toggle: vi.fn(), restart: vi.fn() }),
}))
vi.mock('@/components/xp/useXp', () => ({ useXp: () => ({ xp: { level: { level: 3 }, total: 240, streak: 4 }, reload: vi.fn() }) }))
vi.mock('@/components/plan/usePlans', () => ({ usePlans: () => ({ views: [], setDone: vi.fn() }) }))
vi.mock('@/components/plan/useWarmup', () => ({ useWarmup: () => ({ start: vi.fn(), busy: null, error: null }) }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => [] }))
vi.mock('@/lib/data/tasks', () => ({ listOpenTasks: async () => [], countTasksDoneSince: async () => 0, createTask: vi.fn(), setTaskDone: vi.fn() }))
vi.mock('@/lib/data/classes', () => ({ listClasses: async () => [] }))
vi.mock('@/lib/data/cards', () => ({ countDueCards: async () => 0 }))
vi.mock('@/lib/data/focus', () => ({ listSessionsSince: async () => [] }))
vi.mock('@/lib/data/notes', () => ({ listNotes: async () => [] }))
vi.mock('@/lib/data/decks', () => ({ listDecks: async () => [] }))
vi.mock('@/lib/data/lectures', () => ({ listLectures: async () => [] }))
vi.mock('@/components/topics/WeakSpotsCard', () => ({ WeakSpotsCard: () => <section aria-label="Weak spots" /> }))
vi.mock('@/components/home/CourseAccess', () => ({ CourseAccess: () => <section aria-label="Jump back in" /> }))
vi.mock('@/components/home/HomeActions', () => ({ HomeActions: () => <nav aria-label="Quick actions" /> }))

import { ProfileProvider } from '@/components/providers/ProfileProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'
import HomePage from '@/app/(app)/home/page'

const profile = { id: 'u1', display_name: 'Kwadwo', timezone: 'UTC', daily_goal_minutes: 120, focus_minutes: 25, short_break_minutes: 5, long_break_minutes: 15, long_break_every: 4, default_editor_mode: 'rich', theme: 'light', accent: 'blue', font: 'sans', look: 'studio', auto_math: true, onboarded: true } as Profile
const home = async (p: Partial<Profile> = {}) => { await act(async () => { render(<ProfileProvider initial={{ ...profile, ...p } as Profile}><ToastProvider><HomePage /></ToastProvider></ProfileProvider>) }) }
afterEach(cleanup)

describe('Home, as it was, in the new design', () => {
  it('opens with the hero: the date, the greeting, the goal ring and the focus timer together', async () => {
    await home()
    const hero = within(screen.getByRole('region', { name: 'Welcome' }))
    expect(hero.getByRole('heading', { level: 1 }).textContent).toMatch(/^Good (morning|afternoon|evening), Kwadwo$/)
    expect(hero.getByRole('progressbar', { name: 'Focus goal progress' }).getAttribute('aria-valuetext')).toBe('30m of 2h focus')
    expect(hero.getByRole('button', { name: /Start focus/ })).toBeTruthy()
    expect(hero.getByRole('link', { name: 'Open' }).getAttribute('href')).toBe('/focus')
  })
  it('has the phone shortcuts in the hero: Courses, Library, Profile, Progress and Settings', async () => {
    await home()
    const hero = within(screen.getByRole('region', { name: 'Welcome' }))
    for (const [name, href] of [['Courses', '/courses'], ['Library', '/library'], ['Profile', '/profile'], ['Progress', '/progress'], ['Settings', '/settings']])
      expect(hero.getByRole('link', { name }).getAttribute('href')).toBe(href)
  })
  it('then Today and This week side by side, then Jump back in and Weak spots', async () => {
    await home()
    const order = ['Welcome', 'Today', 'This week', 'Jump back in', 'Weak spots'].map(n => screen.getByRole('region', { name: n }))
    for (let i = 1; i < order.length; i++) expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Today' }).parentElement!.className).toContain('lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]')
  })
  it('Playful shows the level, XP and streak in the hero', async () => {
    await home({ look: 'playful' })
    const hero = within(screen.getByRole('region', { name: 'Welcome' }))
    expect(hero.getByText('Level 3')).toBeTruthy()
    expect(hero.getByText('4-day streak')).toBeTruthy()
  })
  it('Paper shows the goal as a bar and the timer in its own card', async () => {
    await home({ look: 'paper' })
    const bar = screen.getByRole('progressbar', { name: 'Focus goal progress' })
    expect(bar.querySelector('svg')).toBeNull() // a bar, not the ring
    const card = within(screen.getByRole('region', { name: 'Focus' }))
    expect(card.getByRole('button', { name: 'Start focus' })).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'Welcome' })).queryByRole('button', { name: /Start focus/ })).toBeNull()
  })
})
