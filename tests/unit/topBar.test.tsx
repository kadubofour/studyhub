// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act, within } from '@testing-library/react'
import { createTimer, startTimer, pauseTimer } from '@/lib/timer'
import type { XpSummary } from '@/lib/xp/rules'

const MIN = 60_000
let path = '/home'
let timer = createTimer('focus', 25 * MIN)
let now = 0
const toggle = vi.fn()
let xp: XpSummary | null = null
let due = 0
let dueFails = false
vi.mock('next/navigation', () => ({ usePathname: () => path }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/cards', () => ({ countDueCards: async () => { if (dueFails) throw new Error('offline'); return due } }))
vi.mock('@/components/providers/FocusProvider', async orig => ({ ...(await orig<typeof import('@/components/providers/FocusProvider')>()), useFocus: () => ({ timer, now, toggle, todayMinutes: 0 }) }))
let xpKey: unknown
vi.mock('@/components/xp/useXp', () => ({ useXp: (key: unknown) => { xpKey = key; return { xp, reload: vi.fn() } } }))
import { TopBar } from '@/components/shell/TopBar'

const summary = (over: Partial<XpSummary> = {}): XpSummary => ({
  total: 120, today: 10, level: { level: 2, into: 70, span: 150, toNext: 80 }, streak: 0, best: 0, goals: [], allDone: false, bonus: 20, last14: [], ...over,
})
const open = async () => { await act(async () => { render(<TopBar />) }) }
beforeEach(() => { path = '/home'; timer = createTimer('focus', 25 * MIN); now = 0; xp = null; due = 0; dueFails = false; toggle.mockClear() })
afterEach(cleanup)

describe('TopBar celebrations', () => {
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
    for (const [p, name] of [['/home', 'Home'], ['/flashcards/d1', 'Flashcards'], ['/review', 'Review'], ['/progress', 'Progress'], ['/tutor/c1', 'Tutor']] as const) {
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
      expect(screen.queryByText(/-day streak/)).toBeNull()
      cleanup()
      xp = summary({ streak: 4 })
      await open()
      expect(screen.getByText('4-day streak')).toBeTruthy()
      cleanup()
      xp = summary({ streak: 1 })
      await open()
      expect(screen.getByText('1-day streak')).toBeTruthy()
    })
  })
})
