// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useEffect } from 'react'
import { render, act, cleanup, screen } from '@testing-library/react'
import type { Profile } from '@/lib/types'

const push = vi.fn()
const notify = vi.fn()
let tasks: unknown[] = []
let mine: unknown[] = []
let mineReads = 0
vi.mock('@/lib/data/reminders', () => ({ listReminders: async () => { mineReads++; return mine }, REMINDERS_CHANGED: 'studyhub:reminders-changed' }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), useSearchParams: () => new URLSearchParams() }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/tasks', () => ({ listOpenTasks: async () => tasks, setTaskDone: async () => {} }))
vi.mock('@/lib/data/classes', () => ({ listClasses: async () => [] }))
vi.mock('@/lib/data/decks', () => ({ listDecksWithDue: async () => [{ id: 'd', due: 4 }] }))
vi.mock('@/lib/data/focus', () => ({ logFocusSession: async () => {}, listSessionsSince: async () => [] }))
vi.mock('@/lib/focus/alert', () => ({ chime: vi.fn(), vibrate: vi.fn(), primeAudio: vi.fn(), notify: (...a: unknown[]) => notify(...a) }))

import { ProfileProvider } from '@/components/providers/ProfileProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'
import { FocusProvider, useFocus } from '@/components/providers/FocusProvider'
import { ReminderProvider, useReminders, shownReminders } from '@/components/providers/ReminderProvider'
import { DEFAULT_REMINDERS, reminderPrefs, setReminderPrefs } from '@/lib/reminders/prefs'

const profile: Profile = {
  id: 'u', display_name: 'Ama', school: null, programme: null, avatar_color: '#3B5BDB', timezone: 'UTC', daily_goal_minutes: 120, focus_minutes: 25,
  short_break_minutes: 5, long_break_minutes: 15, long_break_every: 4, default_editor_mode: 'rich',
  theme: 'system', accent: 'blue', font: 'sans', look: 'classic', content_width: 'wide', auto_math: true, onboarded: true, friend_code: 'ABCD2345', show_on_boards: true,
}
let focus: ReturnType<typeof useFocus> | null = null
function Grab() { const v = useFocus(); useEffect(() => { focus = v }); return null }
let reminders: ReturnType<typeof useReminders> | null = null
function GrabR() { const v = useReminders(); useEffect(() => { reminders = v }); return null }
const mount = () => render(<ProfileProvider initial={profile}><ToastProvider><FocusProvider><ReminderProvider><Grab /><GrabR /></ReminderProvider></FocusProvider></ToastProvider></ProfileProvider>)
const hidden = (v: 'visible' | 'hidden') => Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v })
const flush = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(1_000) }) }

beforeEach(() => {
  window.localStorage.clear()
  reminderPrefs.set(DEFAULT_REMINDERS); shownReminders.set({})
  tasks = []; mine = []; mineReads = 0; push.mockClear(); notify.mockClear(); hidden('visible')
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'] })
  vi.setSystemTime(new Date('2026-10-16T18:02:00Z')) // two minutes after the flashcard time
})
afterEach(() => { cleanup(); vi.useRealTimers(); hidden('visible'); focus = null; reminders = null })

describe('reminders while the app is open', () => {
  it('shows nothing until they are turned on', async () => {
    mount(); await flush()
    expect(screen.queryByText(/Flashcards to review/)).toBeNull()
  })

  it('tells the student their cards are due, with a button that opens them', async () => {
    setReminderPrefs({ on: true, quiet: null })
    mount(); await flush()
    expect(screen.getByText('Flashcards to review: 4 cards are due.')).toBeTruthy()
    act(() => { screen.getByText('Open').click() })
    expect(push).toHaveBeenCalledWith('/flashcards')
  })

  it('shows each reminder once, even after the page is opened again', async () => {
    setReminderPrefs({ on: true, quiet: null })
    mount(); await flush()
    cleanup()
    mount(); await flush()
    expect(screen.queryByText('Flashcards to review: 4 cards are due.')).toBeNull()
  })

  it('sends a notification too when the student is on another tab', async () => {
    setReminderPrefs({ on: true, quiet: null })
    hidden('hidden')
    mount(); await flush()
    expect(notify).toHaveBeenCalledWith('Flashcards to review', '4 cards are due.', expect.objectContaining({ tag: 'cards:2026-10-16' }))
  })

  it('still tells the student during a focus session: a class would not wait', async () => {
    mount(); await act(async () => { focus!.toggle() })
    await act(async () => { setReminderPrefs({ on: true, quiet: null }) })
    await flush()
    expect(screen.getByText('Flashcards to review: 4 cards are due.')).toBeTruthy()
  })

  it('puts several reminders at once in one message, so none is replaced by the next', async () => {
    vi.setSystemTime(new Date('2026-10-16T18:02:00Z'))
    setReminderPrefs({ on: true, quiet: null, goal: '18:00' }) // cards and goal are both due now
    mount(); await flush()
    expect(screen.getByText(/2 reminders: Flashcards to review, Daily goal/)).toBeTruthy()
  })

  it('a reminder claimed by a tab nobody was looking at is shown when the student opens one', async () => {
    setReminderPrefs({ on: true, quiet: null })
    hidden('hidden')
    mount(); await flush()
    expect(notify).toHaveBeenCalledTimes(1)
    cleanup() // that tab is left behind
    hidden('visible')
    mount(); await flush()
    expect(screen.getByText('Flashcards to review: 4 cards are due.')).toBeTruthy()
    expect(notify).toHaveBeenCalledTimes(1) // not notified twice
    cleanup(); mount(); await flush()
    expect(screen.queryByText('Flashcards to review: 4 cards are due.')).toBeNull() // and only once
  })

  it('stays quiet in quiet hours', async () => {
    setReminderPrefs({ on: true, quiet: { from: '18:00', to: '19:00' } })
    mount(); await flush()
    expect(screen.queryByText(/Flashcards to review/)).toBeNull()
  })

  it('has a test reminder', async () => {
    setReminderPrefs({ on: true })
    mount(); await flush()
    act(() => { reminders!.test() })
    expect(screen.getByText('Reminders are on: This is what a reminder looks like.')).toBeTruthy()
  })

  describe('my own reminders', () => {
    const own = { id: 'm1', title: 'Email my tutor', day: '2026-10-16', at: '18:00:00', repeat: 'once' }
    it('show at their time even with the automatic reminders off, opening the reminders in the Planner', async () => {
      mine = [own]
      mount(); await flush()
      expect(screen.getByText('Reminder: Email my tutor')).toBeTruthy()
      act(() => { screen.getByText('Open').click() })
      expect(push).toHaveBeenCalledWith('/planner?list=reminders')
    })
    it('show in quiet hours too: the student chose that time', async () => {
      mine = [own]
      setReminderPrefs({ on: true, quiet: { from: '18:00', to: '19:00' } })
      mount(); await flush()
      expect(screen.getByText(/Email my tutor/)).toBeTruthy()
    })
    it('are read again when the Reminders page changes them', async () => {
      mount(); await flush()
      const before = mineReads
      mine = [own]
      await act(async () => { window.dispatchEvent(new Event('studyhub:reminders-changed')); await vi.advanceTimersByTimeAsync(500) })
      expect(mineReads).toBeGreaterThan(before)
      expect(screen.getByText('Reminder: Email my tutor')).toBeTruthy()
    })
  })

  it('reads the reminders again on coming back to the tab only when it has been a while', async () => {
    mount(); await flush()
    const before = mineReads
    for (let i = 0; i < 3; i++) await act(async () => { hidden('visible'); document.dispatchEvent(new Event('visibilitychange')) })
    expect(mineReads).toBe(before) // a few seconds later: nothing new to read
    await act(async () => { vi.advanceTimersByTime(90_000); document.dispatchEvent(new Event('visibilitychange')) })
    expect(mineReads).toBeGreaterThan(before) // after a while away it reads again
  })
})
