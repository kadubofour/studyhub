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
let mine: unknown[] = []
vi.mock('@/lib/data/reminders', () => ({ listReminders: async () => mine, REMINDERS_CHANGED: 'studyhub:reminders-changed' }))
let doneSince = 0
vi.mock('@/lib/data/tasks', () => ({ listOpenTasks: async () => [], countTasksDoneSince: async () => doneSince, createTask: vi.fn(), setTaskDone: vi.fn() }))
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
    expect(screen.getByRole('region', { name: 'Welcome' }).className).toContain('hero-page')
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
  it.each(['playful', 'paper', 'classic'] as const)('%s: the greeting leaves the level, XP and streak to the top bar', async look => {
    await home({ look })
    const hero = within(screen.getByRole('region', { name: 'Welcome' }))
    expect(hero.queryByText(/Level 3/)).toBeNull()
    expect(hero.queryByText(/streak/)).toBeNull()
    expect(hero.queryByText(/240 XP/)).toBeNull()
  })
  it('the focus timer sits at the right of the greeting, after the goal', async () => {
    await home({ look: 'playful' })
    const row = within(screen.getByRole('region', { name: 'Welcome' })).getByRole('progressbar', { name: 'Focus goal progress' }).parentElement!
    expect(row.children).toHaveLength(2)
    expect(row.lastElementChild!.textContent).toContain('Start focus')
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

describe('Home lines up', () => {
  it('Today and This week are the same height: the row stretches and This week fills its column', async () => {
    await home()
    const row = screen.getByRole('region', { name: 'Today' }).parentElement!
    expect(row.className).not.toContain('items-start')
    expect(screen.getByRole('region', { name: 'This week' }).className).toContain('flex-1')
  })
})

describe('reminders on Home', () => {
  afterEach(() => { mine = []; vi.useRealTimers() })
  it('Today lists the reminders still to come today, with their time, and not later ones', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-23T10:00:00Z'))
    mine = [
      { id: 'a', title: 'Email my tutor', day: '2026-10-23', at: '16:00:00', repeat: 'once' },
      { id: 'b', title: 'Earlier today', day: '2026-10-23', at: '08:00:00', repeat: 'once' },
      { id: 'c', title: 'Tomorrow', day: '2026-10-24', at: '09:00:00', repeat: 'once' },
    ]
    await home({ timezone: 'UTC' } as Partial<Profile>)
    const today = within(screen.getByRole('region', { name: 'Today' }))
    expect(today.getByRole('list', { name: 'Reminders today' }).textContent).toContain('16:00')
    expect(today.getByRole('list', { name: 'Reminders today' }).textContent).toContain('Email my tutor')
    expect(today.queryByText('Earlier today')).toBeNull()
    expect(today.queryByText('Tomorrow')).toBeNull()
  })
})

describe('Home on a phone', () => {
  it('the goal is a slim bar on a phone and the ring on wider screens, in one progress bar', async () => {
    await home()
    const goal = within(screen.getByRole('region', { name: 'Welcome' })).getByRole('progressbar', { name: 'Focus goal progress' })
    expect(goal.querySelector('svg')!.getAttribute('class')).toContain('hidden sm:block')
    expect(goal.querySelector('[data-goal-bar]')!.className).toContain('sm:hidden')
  })
})

describe('Home, less generic', () => {
  it("under the greeting: the date and today's one fact, in words", async () => {
    await home()
    const hero = within(screen.getByRole('region', { name: 'Welcome' }))
    expect(hero.getByText(/Nothing due today./).tagName).toBe('P')
  })
  it('This week states its total and draws the goal as a dashed line; only today is in colour', async () => {
    await home()
    const week = screen.getByRole('region', { name: 'This week' })
    expect(within(week).getByText('0m in all')).toBeTruthy()
    const goal = week.querySelector('[data-goal-line]') as HTMLElement
    expect(goal.className).toContain('border-dashed')
    expect(goal.textContent).toBe('Goal 2h')
    const bars = [...week.querySelectorAll('[data-bar]')] as HTMLElement[]
    expect(bars).toHaveLength(7)
    const today = bars.filter(b => b.hasAttribute('data-today'))
    expect(today).toHaveLength(1)
    expect(today[0].style.background).toBe('var(--accent-solid)')
    for (const b of bars.filter(x => !x.hasAttribute('data-today'))) expect(b.style.background).not.toContain('accent')
  })
})

describe('the quick cards', () => {
  it('are on Home on every screen, not on phones only', async () => {
    await home()
    expect(screen.getByRole('navigation', { name: 'Quick actions' }).closest('[class~="md:hidden"]')).toBeNull()
  })
})

describe('Today when everything is done', () => {
  afterEach(() => { doneSince = 0 })
  it('says so, rather than nothing is due', async () => {
    doneSince = 2
    await home()
    const today = within(screen.getByRole('region', { name: 'Today' }))
    expect(today.getByText('All done for today. Add something below if you like.')).toBeTruthy()
    expect(today.queryByText(/Nothing due today/)).toBeNull()
  })
  it('still says nothing is due when nothing was', async () => {
    await home()
    expect(within(screen.getByRole('region', { name: 'Today' })).getByText('Nothing due today. Add something below.')).toBeTruthy()
  })
})
