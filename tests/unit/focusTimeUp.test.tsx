// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, cleanup } from '@testing-library/react'
import { useEffect } from 'react'
import type { Profile } from '@/lib/types'

const logFocusSession = vi.fn<(sb: unknown, session: Record<string, unknown>) => Promise<void>>().mockResolvedValue(undefined)
const setTaskDone = vi.fn(async (..._a: unknown[]) => {})
const chime = vi.fn(), vibrate = vi.fn(), notify = vi.fn(), primeAudio = vi.fn()
vi.mock('@/lib/data/focus', () => ({ logFocusSession: (sb: unknown, s: Record<string, unknown>) => logFocusSession(sb, s), listSessionsSince: async () => [] }))
vi.mock('@/lib/data/tasks', () => ({ setTaskDone: (...a: unknown[]) => setTaskDone(...a) }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/focus/alert', () => ({ chime: (...a: unknown[]) => chime(...a), vibrate: () => vibrate(), notify: (...a: unknown[]) => notify(...a), primeAudio: () => primeAudio() }))

import { ProfileProvider } from '@/components/providers/ProfileProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'
import { FocusProvider, useFocus } from '@/components/providers/FocusProvider'
import { screen, fireEvent } from '@testing-library/react'
import { focusPrefs, setFocusPrefs, DEFAULT_PREFS } from '@/lib/focus/prefs'
import { setFocusTask } from '@/lib/focus/task'

const profile: Profile = {
  id: 'u', display_name: 'Ama', school: null, programme: null, avatar_color: '#3B5BDB', timezone: 'UTC', daily_goal_minutes: 120, focus_minutes: 1,
  short_break_minutes: 5, long_break_minutes: 15, long_break_every: 4, default_editor_mode: 'rich',
  theme: 'system', accent: 'blue', font: 'sans', look: 'classic', content_width: 'wide', auto_math: true, onboarded: true, friend_code: 'ABCD2345', show_on_boards: true,
}

let api: ReturnType<typeof useFocus> | null = null
function Grab() { const v = useFocus(); useEffect(() => { api = v }); return null }
const mount = (p: Profile = profile) => render(<ProfileProvider initial={p}><ToastProvider><FocusProvider><Grab /></FocusProvider></ToastProvider></ProfileProvider>)
const hidden = (v: 'visible' | 'hidden') => Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v })

beforeEach(() => {
  window.localStorage.clear()
  focusPrefs.set(DEFAULT_PREFS); setFocusTask(null)
  for (const f of [logFocusSession, setTaskDone, chime, vibrate, notify, primeAudio]) f.mockClear()
  hidden('visible')
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'] })
  vi.setSystemTime(new Date('2026-10-02T10:00:00Z'))
})
afterEach(() => { cleanup(); vi.useRealTimers(); hidden('visible'); api = null })

const runOut = async (minutes = 1) => { await act(async () => { api!.toggle() }); await act(async () => { await vi.advanceTimersByTimeAsync(minutes * 60_000 + 1_000) }) }

describe('when time is up', () => {
  it('chimes and vibrates (sound is on by default), and says so on the page', async () => {
    mount()
    await runOut()
    expect(chime).toHaveBeenCalledTimes(1); expect(vibrate).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Focus session done. Time for a break.')).toBeTruthy()
    expect(api!.timer.mode).toBe('short') // on to the break, stopped
    expect(api!.timer.startedAt).toBeNull()
  })

  it('stays quiet when sound is off, and sends a notification only when it is on and the student is away', async () => {
    setFocusPrefs({ sound: false })
    mount()
    await runOut()
    expect(chime).not.toHaveBeenCalled(); expect(vibrate).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled() // notifications are off

    cleanup()
    window.localStorage.clear(); setFocusPrefs({ notify: true }); api = null // a new session, with notifications on
    mount()
    await runOut()
    expect(notify).toHaveBeenCalledWith('Focus session done', 'Time for a break.')
  })

  it('puts "Focus session done" in the tab title while the student is away, and takes it off when they are back', async () => {
    mount()
    hidden('hidden')
    await runOut()
    expect(document.title).toBe('⏰ Focus session done')
    hidden('visible')
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(document.title).toBe('Studyhub')
  })

  it('does not touch the tab title when the student is looking at the page', async () => {
    mount()
    await runOut()
    expect(document.title).toBe('Studyhub')
  })

  it('says "Break over" when a break ends', async () => {
    mount({ ...profile, short_break_minutes: 1 })
    await act(async () => { api!.pickMode('short') })
    await runOut()
    expect(screen.getByText('Break over. Ready to focus?')).toBeTruthy()
    expect(notify).not.toHaveBeenCalled()
    expect(api!.timer.mode).toBe('focus')
  })

  it('primes the sound when the timer is started, because a tap is what lets a page make a sound later', async () => {
    mount()
    await act(async () => { api!.toggle() })
    expect(primeAudio).toHaveBeenCalled()
  })
})

describe('keeping the screen on', () => {
  const request = vi.fn(async (_t: string) => ({ release: async () => {} }))
  beforeEach(() => { request.mockClear(); Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } }) })
  afterEach(() => { Reflect.deleteProperty(navigator, 'wakeLock') })
  it('holds the screen while a session runs, and not while it is stopped', async () => {
    mount()
    await act(async () => {})
    expect(request).not.toHaveBeenCalled()
    await act(async () => { api!.toggle() })
    expect(request).toHaveBeenCalledWith('screen')
  })
  it('does not when the student turned it off', async () => {
    setFocusPrefs({ keepAwake: false })
    mount()
    await act(async () => { api!.toggle() })
    expect(request).not.toHaveBeenCalled()
  })
})

describe('starting the next one automatically', () => {
  it('is off by default: the break waits to be started', async () => {
    mount()
    await runOut()
    expect(api!.timer).toMatchObject({ mode: 'short', startedAt: null })
  })
  it('rolls a finished session into its break, already running, and the break into the next session', async () => {
    setFocusPrefs({ autoStart: true })
    mount({ ...profile, short_break_minutes: 1 })
    await runOut()
    expect(api!.timer.mode).toBe('short'); expect(api!.timer.startedAt).not.toBeNull()
    await act(async () => { await vi.advanceTimersByTimeAsync(61_000) })
    expect(api!.timer.mode).toBe('focus'); expect(api!.timer.startedAt).not.toBeNull()
  })
  it('does not start anything when the student skips', async () => {
    setFocusPrefs({ autoStart: true })
    mount()
    await act(async () => { api!.skip() })
    expect(api!.timer.startedAt).toBeNull()
  })
})

describe('what the student is working on', () => {
  const task = { uid: 'u', id: 't1', title: 'Read chapter 7', course_id: 'c1' }

  it('is saved with the session that is logged', async () => {
    setFocusTask(task)
    mount()
    await act(async () => {})
    expect(api!.task).toEqual(task)
    await runOut()
    expect(logFocusSession).toHaveBeenCalledTimes(1) // a session that runs its full time is logged, with what it was spent on
    expect(logFocusSession.mock.calls[0][1]).toMatchObject({ taskId: 't1', courseId: 'c1', completed: true, minutes: 1 })
    logFocusSession.mockClear()
    cleanup(); window.localStorage.clear(); setFocusTask(task); api = null // a new session
    mount({ ...profile, focus_minutes: 25 })
    await act(async () => { api!.toggle() })
    await act(async () => { await vi.advanceTimersByTimeAsync(10 * 60_000) })
    await act(async () => { api!.skip() })
    expect(logFocusSession).toHaveBeenCalledTimes(1)
    expect(logFocusSession.mock.calls[0][1]).toMatchObject({ taskId: 't1', courseId: 'c1', completed: false, minutes: 10 })
  })

  it('is ignored when it belongs to another student', async () => {
    setFocusTask({ ...task, uid: 'someone-else' })
    mount()
    await act(async () => {})
    expect(api!.task).toBeNull()
  })

  it('is offered to be marked done when a focus session finishes, and marking it done clears it', async () => {
    setFocusTask(task)
    mount()
    await runOut()
    fireEvent.click(screen.getByRole('button', { name: /Mark “Read chapter 7” done/ }))
    await act(async () => {})
    expect(setTaskDone).toHaveBeenCalledWith({}, 't1', true)
    expect(api!.task).toBeNull()
    expect(screen.getByText('Marked “Read chapter 7” done.')).toBeTruthy()
  })

  it('says it could not when marking it done fails, and keeps it', async () => {
    setTaskDone.mockRejectedValueOnce(new Error('offline'))
    setFocusTask(task)
    mount()
    await runOut()
    fireEvent.click(screen.getByRole('button', { name: /Mark “Read chapter 7” done/ }))
    await act(async () => {})
    expect(screen.getByText('Couldn\'t mark it done.')).toBeTruthy()
    expect(api!.task).toEqual(task)
  })

  it('offers nothing to mark done when there is no task', async () => {
    mount()
    await runOut()
    expect(screen.queryByRole('button', { name: /Mark/ })).toBeNull()
  })
})

describe('the length of the session', () => {
  it('can be changed before the session begins, for that session only', async () => {
    mount()
    await act(async () => { api!.setDuration(45 * 60) })
    expect(api!.timer.durationMs).toBe(45 * 60_000); expect(api!.timer.mode).toBe('focus')
  })
  it('can be any length down to the second, kept between five seconds and three hours', async () => {
    mount()
    await act(async () => { api!.setDuration(37 * 60) })
    expect(api!.timer.durationMs).toBe(37 * 60_000)
    await act(async () => { api!.setDuration(90) })
    expect(api!.timer.durationMs).toBe(90_000)
    await act(async () => { api!.setDuration(999 * 60) })
    expect(api!.timer.durationMs).toBe(180 * 60_000)
    await act(async () => { api!.setDuration(0) })
    expect(api!.timer.durationMs).toBe(5_000)
  })
  it('cannot be changed once it is running, or once part of it has gone', async () => {
    mount()
    await act(async () => { api!.toggle() })
    await act(async () => { api!.setDuration(45 * 60) })
    expect(api!.timer.durationMs).toBe(60_000)
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
    await act(async () => { api!.toggle() }) // paused with some time gone
    await act(async () => { api!.setDuration(45 * 60) })
    expect(api!.timer.durationMs).toBe(60_000)
  })
  it('goes back to the Settings length for the next session', async () => {
    mount({ ...profile, short_break_minutes: 5 })
    await act(async () => { api!.setDuration(15 * 60) })
    await runOut(15)
    expect(api!.timer.mode).toBe('short'); expect(api!.timer.durationMs).toBe(5 * 60_000)
  })
})

