// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act, within } from '@testing-library/react'
import { createTimer, startTimer, pauseTimer } from '@/lib/timer'
import { forgetXp } from '@/lib/xp/celebrate'
import { announceProgressChanged } from '@/lib/xp/events'
import type { XpSummary } from '@/lib/xp/rules'

const MIN = 60_000
let path = '/home'
let timer = createTimer('focus', 25 * MIN)
let now = 0
const toggle = vi.fn()
let xp: XpSummary | null = null
let due = 0
let countCalls = 0
let dueFails = false
vi.mock('next/navigation', () => ({ usePathname: () => path }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
let classes: { course_id: string; day_of_week: number; start_time: string; end_time: string }[] = []
vi.mock('@/lib/data/classes', () => ({ listClasses: async () => classes }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => [{ id: 'bio', name: 'Biology', color: '#000000' }] }))
vi.mock('@/components/providers/ProfileProvider', () => ({ useProfile: () => ({ profile: { timezone: 'UTC' } }) }))
vi.mock('@/lib/data/cards', () => ({ countDueCards: async () => { countCalls++; if (dueFails) throw new Error('offline'); return due } }))
vi.mock('@/components/providers/FocusProvider', async orig => ({ ...(await orig<typeof import('@/components/providers/FocusProvider')>()), useFocus: () => ({ timer, now, toggle, todayMinutes: 0 }) }))
let xpKey: unknown
vi.mock('@/components/xp/useXp', () => ({ useXp: (key: unknown) => { xpKey = key; return { xp, reload: vi.fn() } } }))
import { TopBar } from '@/components/shell/TopBar'

const summary = (over: Partial<XpSummary> = {}): XpSummary => ({
  total: 120, today: 10, level: { level: 2, into: 70, span: 150, toNext: 80 }, streak: 0, best: 0, goals: [], allDone: false, bonus: 20, last14: [], ...over,
})
const open = async () => { await act(async () => { render(<TopBar />) }) }
beforeEach(() => { forgetXp(); countCalls = 0; path = '/home'; timer = createTimer('focus', 25 * MIN); now = 0; xp = null; due = 0; dueFails = false; toggle.mockClear() })
afterEach(cleanup)

describe('TopBar keeping up', () => {
  it('counts the due cards again when something says progress changed, such as finishing a review', async () => {
    due = 3
    await open()
    expect(screen.getByRole('link', { name: '3 cards due' })).toBeTruthy()
    due = 0
    await act(async () => { announceProgressChanged() })
    expect(screen.getByRole('link', { name: 'No cards due' })).toBeTruthy()
    expect(countCalls).toBe(2)
  })
  it('leaves room for the Show sidebar button when the sidebar is hidden', async () => {
    await act(async () => { render(<TopBar sidebarHidden />) })
    expect(screen.getByRole('banner').className).toContain('md:pl-16')
  })
  it('has short and long wording for narrow and wide screens, so nothing is cut off on a phone', async () => {
    due = 12
    xp = summary({ streak: 4 })
    await open()
    const bar = screen.getByRole('banner')
    for (const text of ['12', '12 cards due', 'Lv 2', 'Level 2']) expect(within(bar).getAllByText(text).length, text).toBeGreaterThan(0)
  })
  it('keeps the streak short: the flame and the number, with the words only for screen readers', async () => {
    xp = summary({ streak: 4 })
    await open()
    const chip = screen.getByLabelText('4-day streak')
    expect(chip.textContent).toBe('4')
  })
  it('shows the cheer first in the strip, so it does not push the other chips about', async () => {
    xp = summary({ total: 120 })
    const { rerender } = render(<TopBar />)
    xp = summary({ total: 130 })
    await act(async () => { rerender(<TopBar />) })
    const strip = screen.getByRole('banner').querySelector('.overflow-x-auto')!
    expect(strip.firstElementChild!.textContent).toBe('+10 XP')
  })
})

describe('TopBar celebrations', () => {
  it('still celebrates after a full-screen page took the bar away and brought it back', async () => {
    xp = summary({ total: 120 })
    const first = render(<TopBar />)
    await act(async () => {})
    first.unmount() // a quiz or note editor page: no top bar
    xp = summary({ total: 135 })
    await act(async () => { render(<TopBar />) })
    expect(screen.getByRole('status').textContent).toBe('+15 XP')
  })
  const level = (n: number, into = 10) => ({ level: n, into, span: 150, toNext: 140 })
  it('reads XP again on every page, so a session finished elsewhere is noticed', async () => {
    path = '/home'
    await open()
    const first = xpKey
    cleanup()
    path = '/planner'
    await open()
    expect(xpKey).not.toBe(first)
  })
  it('has one polite status area, empty at first and when XP is first read', async () => {
    xp = summary({ total: 120 })
    await open()
    const status = screen.getByRole('status')
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.textContent).toBe('')
  })
  it('cheers the points gained when XP goes up', async () => {
    xp = summary({ total: 120 })
    const { rerender } = render(<TopBar />)
    xp = summary({ total: 145 })
    await act(async () => { rerender(<TopBar />) })
    expect(screen.getByRole('status').textContent).toBe('+25 XP')
  })
  it('announces a new level', async () => {
    xp = summary({ total: 190, level: level(2) })
    const { rerender } = render(<TopBar />)
    xp = summary({ total: 210, level: level(3) })
    await act(async () => { rerender(<TopBar />) })
    expect(screen.getByRole('status').textContent).toBe('Level up! You reached level 3 (+20 XP)')
  })
  it('stays quiet when nothing was gained', async () => {
    xp = summary({ total: 120 })
    const { rerender } = render(<TopBar />)
    xp = summary({ total: 120 })
    await act(async () => { rerender(<TopBar />) })
    expect(screen.getByRole('status').textContent).toBe('')
  })
  it('fades away after a few seconds', async () => {
    vi.useFakeTimers()
    try {
      xp = summary({ total: 120 })
      const { rerender } = render(<TopBar />)
      xp = summary({ total: 130 })
      await act(async () => { rerender(<TopBar />) })
      expect(screen.getByRole('status').textContent).toBe('+10 XP')
      await act(async () => { vi.advanceTimersByTime(4500) })
      expect(screen.getByRole('status').textContent).toBe('')
    } finally { vi.useRealTimers() }
  })
})

describe('TopBar', () => {
  it('is a labelled region with the page name', async () => {
    path = '/planner'
    await open()
    const bar = screen.getByRole('banner', { name: 'Today at a glance' })
    expect(within(bar).getByText('Planner')).toBeTruthy()
  })
  it('names the page for each section, and nothing for an unknown one', async () => {
    for (const [p, name] of [['/home', 'Home'], ['/library', 'Library'], ['/profile', 'Profile'], ['/courses/c1', 'Courses'], ['/courses', 'Courses'], ['/flashcards/d1', 'Flashcards'], ['/review', 'Review'], ['/progress', 'Progress'], ['/tutor/c1', 'Tutor']] as const) {
      path = p
      await open()
      expect(within(screen.getByRole('banner')).getByText(name), p).toBeTruthy()
      cleanup()
    }
    path = '/somewhere-else'
    await open()
    expect(screen.getByRole('banner').querySelector('[data-page]')).toBeNull()
  })

  describe('focus timer', () => {
    it('shows the time left and offers to start', async () => {
      await open()
      expect(screen.getByRole('link', { name: /Focus timer, 25:00 left/ }).getAttribute('href')).toBe('/focus')
      expect(screen.getByRole('button', { name: 'Start focus timer' })).toBeTruthy()
    })
    it('counts down while running and offers to pause', async () => {
      timer = startTimer(timer, 0); now = 5 * MIN
      await open()
      expect(screen.getByRole('link', { name: /20:00 left/ })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Pause focus timer' })).toBeTruthy()
    })
    it('offers to resume when paused part way', async () => {
      timer = pauseTimer(startTimer(timer, 0), 5 * MIN); now = 9 * MIN
      await open()
      expect(screen.getByRole('button', { name: 'Resume focus timer' })).toBeTruthy()
    })
    it('names a break as a break', async () => {
      timer = createTimer('short', 5 * MIN)
      await open()
      expect(screen.getByRole('link', { name: /Short break timer, 05:00 left/ })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Start short break timer' })).toBeTruthy()
    })
    it('starts and pauses with the same button', async () => {
      await open()
      fireEvent.click(screen.getByRole('button', { name: 'Start focus timer' }))
      expect(toggle).toHaveBeenCalledTimes(1)
    })
  })

  describe('cards due', () => {
    it('links to the review when some are due', async () => {
      due = 12
      await open()
      const link = screen.getByRole('link', { name: '12 cards due' })
      expect(link.getAttribute('href')).toBe('/review')
    })
    it('says one card, in the singular', async () => {
      due = 1
      await open()
      expect(screen.getByRole('link', { name: '1 card due' })).toBeTruthy()
    })
    it('links to the flashcards when none are', async () => {
      await open()
      expect(screen.getByRole('link', { name: 'No cards due' }).getAttribute('href')).toBe('/flashcards')
    })
    it('shows nothing about cards when they cannot be counted', async () => {
      dueFails = true
      await open()
      expect(screen.queryByRole('link', { name: /cards? due/ })).toBeNull()
      expect(screen.queryByRole('link', { name: /No cards due/ })).toBeNull()
    })
  })

  describe('streak and level', () => {
    it('shows nothing about XP until it is known', async () => {
      await open()
      expect(screen.queryByText(/Level/)).toBeNull()
    })
    it('shows the level with its progress in words', async () => {
      xp = summary()
      await open()
      expect(screen.getByText('Level 2')).toBeTruthy()
      const bar = screen.getByRole('progressbar', { name: 'Progress to level 3' })
      expect(bar.getAttribute('aria-valuenow')).toBe('70')
      expect(bar.getAttribute('aria-valuemax')).toBe('150')
      expect(bar.getAttribute('aria-valuetext')).toBe('70 of 150 XP')
    })
    it('shows the streak only when there is one', async () => {
      xp = summary({ streak: 0 })
      await open()
      expect(screen.queryByLabelText(/-day streak/)).toBeNull()
      cleanup()
      xp = summary({ streak: 4 })
      await open()
      expect(screen.getByLabelText('4-day streak')).toBeTruthy()
      cleanup()
      xp = summary({ streak: 1 })
      await open()
      expect(screen.getByLabelText('1-day streak')).toBeTruthy()
    })
  })
})

describe('TopBar class period', () => {
  // Thursday 2026-10-01 10:00 UTC (day_of_week 4)
  const slot = (start: string, end: string) => ({ course_id: 'bio', day_of_week: 4, start_time: start, end_time: end })
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-01T10:00:00Z')); classes = [] })
  afterEach(() => { vi.useRealTimers(); classes = [] })
  it('says which class is on now and links to the planner', async () => {
    classes = [slot('09:30:00', '10:30:00')]
    await open()
    const chip = screen.getByRole('link', { name: 'Biology · till 10:30' })
    expect(chip.getAttribute('href')).toBe('/planner')
  })
  it('says the next class today', async () => {
    classes = [slot('14:00:00', '15:00:00')]
    await open()
    expect(screen.getByRole('link', { name: 'Biology · 14:00' })).toBeTruthy()
  })
  it('has no chip when there is no class left today', async () => {
    classes = [slot('08:00:00', '09:00:00')]
    await open()
    expect(screen.queryByRole('link', { name: /Biology/ })).toBeNull()
  })
})
