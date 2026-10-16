// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'
import type { Profile } from '@/lib/types'
import { localStore } from '@/lib/ui/localStore'

const listOpenTasks = vi.fn()
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/tasks', () => ({ listOpenTasks: () => listOpenTasks(), setTaskDone: vi.fn() }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => [{ id: 'c1', name: 'Biology', color: '#1D9E75' }] }))
vi.mock('@/lib/data/focus', () => ({ logFocusSession: vi.fn(async () => {}), listSessionsSince: async () => [] }))

import { ProfileProvider } from '@/components/providers/ProfileProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'
import { FocusProvider } from '@/components/providers/FocusProvider'
import FocusPage from '@/app/(app)/focus/page'
import { FocusAlerts } from '@/components/focus/FocusAlerts'
import { chime, notify, notificationPermission, askNotificationPermission, vibrate, primeAudio } from '@/lib/focus/alert'
import { focusPrefs, DEFAULT_PREFS } from '@/lib/focus/prefs'
import { focusTaskStore } from '@/lib/focus/task'

const profile: Profile = {
  id: 'u', display_name: 'Ama', school: null, programme: null, avatar_color: '#3B5BDB', timezone: 'UTC', daily_goal_minutes: 120, focus_minutes: 25,
  short_break_minutes: 5, long_break_minutes: 15, long_break_every: 4, default_editor_mode: 'rich',
  theme: 'system', accent: 'blue', font: 'sans', look: 'classic', content_width: 'wide', auto_math: true, onboarded: true,
}
const page = () => render(<ProfileProvider initial={profile}><ToastProvider><FocusProvider><FocusPage /></FocusProvider></ToastProvider></ProfileProvider>)
const tasks = [
  { id: 't1', course_id: 'c1', title: 'Read chapter 7', type: 'reading', due_at: '2026-10-20T12:00:00Z', priority: 'normal', done_at: null, created_at: '' },
  { id: 't2', course_id: null, title: 'Email supervisor', type: 'other', due_at: null, priority: 'low', done_at: null, created_at: '' },
]

beforeEach(() => { HTMLMediaElement.prototype.pause = () => {}; window.localStorage.clear(); focusPrefs.set(DEFAULT_PREFS); focusTaskStore.set(null); listOpenTasks.mockReset().mockResolvedValue(tasks) })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('localStore', () => {
  it('returns the same object until the stored text changes, and cleans what it finds', () => {
    const store = localStore<{ n: number }>('t.key', { n: 0 }, v => ({ n: typeof (v as { n?: unknown })?.n === 'number' ? (v as { n: number }).n : -1 }))
    expect(store.get()).toEqual({ n: 0 })
    expect(store.get()).toBe(store.get())
    store.set({ n: 5 })
    expect(store.get()).toEqual({ n: 5 })
    window.localStorage.setItem('t.key', '{"n":"junk"}')
    expect(store.get()).toEqual({ n: -1 })
    window.localStorage.setItem('t.key', 'not json')
    expect(store.get()).toEqual({ n: 0 }) // unreadable falls back
  })
  it('tells listeners when it is set, and when another tab changes it', () => {
    const store = localStore<number>('t.num', 1, v => Number(v))
    const heard = vi.fn()
    const off = store.subscribe(heard)
    store.set(2); expect(heard).toHaveBeenCalledTimes(1)
    window.dispatchEvent(new StorageEvent('storage', { key: 't.num' })); expect(heard).toHaveBeenCalledTimes(2)
    window.dispatchEvent(new StorageEvent('storage', { key: 'other' })); expect(heard).toHaveBeenCalledTimes(2)
    off(); store.set(3); expect(heard).toHaveBeenCalledTimes(2)
  })
  it('keeps the value for the page when storage is unavailable', () => {
    const store = localStore<number>('t.blocked', 1, v => Number(v))
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full') })
    expect(() => store.set(9)).not.toThrow()
    vi.restoreAllMocks()
  })
})

describe('the focus preferences', () => {
  it('start with sound on, notifications off and no automatic start, and ignore junk in storage', () => {
    expect(focusPrefs.get()).toEqual({ sound: true, notify: false, autoStart: false })
    window.localStorage.setItem('studyhub.focus.prefs', JSON.stringify({ sound: 'yes', notify: true, extra: 1 }))
    expect(focusPrefs.get()).toEqual({ sound: true, notify: true, autoStart: false })
  })
})

describe('the alert module', () => {
  it('chimes with three notes, and does nothing (and does not throw) without audio', () => {
    const osc = { type: '', frequency: { value: 0 }, connect: vi.fn().mockReturnThis(), start: vi.fn(), stop: vi.fn() }
    const gain = { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn().mockReturnThis() }
    const Ctx = vi.fn(function (this: unknown) { Object.assign(this as object, { currentTime: 0, state: 'running', destination: {}, createOscillator: () => osc, createGain: () => gain, resume: vi.fn() }) })
    vi.stubGlobal('AudioContext', Ctx)
    chime()
    expect(osc.start).toHaveBeenCalledTimes(3)
    expect(osc.frequency.value).toBe(1046.5) // the last of the three notes
    vi.unstubAllGlobals(); vi.stubGlobal('AudioContext', undefined)
    expect(() => { chime(); primeAudio() }).not.toThrow()
  })

  it('vibrates when the phone can, and not otherwise', () => {
    const v = vi.fn(); Object.defineProperty(navigator, 'vibrate', { configurable: true, value: v })
    vibrate(); expect(v).toHaveBeenCalledTimes(1)
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: undefined })
    expect(() => vibrate()).not.toThrow()
  })

  it('notifies only when allowed and the student is away', () => {
    const made: string[] = []
    class N { static permission: NotificationPermission = 'granted'; static requestPermission = vi.fn(async () => 'granted' as const); onclick: (() => void) | null = null; constructor(t: string) { made.push(t) } close() {} }
    vi.stubGlobal('Notification', N)
    const vis = (v: string) => Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v })
    vis('visible'); notify('Done', 'x'); expect(made).toEqual([])
    vis('hidden'); notify('Done', 'x'); expect(made).toEqual(['Done'])
    N.permission = 'denied'; notify('Again', 'x'); expect(made).toEqual(['Done'])
    vis('visible')
  })

  it('asks the browser once, and reports what it answered', async () => {
    class N { static permission: NotificationPermission = 'default'; static requestPermission = vi.fn(async () => { N.permission = 'granted'; return 'granted' as const }) }
    vi.stubGlobal('Notification', N)
    expect(notificationPermission()).toBe('default')
    expect(await askNotificationPermission()).toBe('granted')
    expect(await askNotificationPermission()).toBe('granted')
    expect(N.requestPermission).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
    delete (window as { Notification?: unknown }).Notification
    expect(notificationPermission()).toBe('unsupported')
    expect(await askNotificationPermission()).toBe('unsupported')
  })
})

describe('the "When time is up" card', () => {
  it('shows the three switches with their state, and changes the saved choice', () => {
    render(<FocusAlerts />)
    const sound = screen.getByRole('switch', { name: 'Sound and vibration' })
    expect(sound.getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('switch', { name: 'Notification' }).getAttribute('aria-checked')).toBe('false')
    fireEvent.click(screen.getByRole('switch', { name: 'Start the next one automatically' }))
    expect(focusPrefs.get().autoStart).toBe(true)
    fireEvent.click(sound)
    expect(focusPrefs.get().sound).toBe(false)
  })

  it('turns notifications on only when the browser allows them, and says so when it does not', async () => {
    class N { static permission: NotificationPermission = 'default'; static requestPermission = vi.fn<() => Promise<NotificationPermission>>(async () => 'denied') }
    vi.stubGlobal('Notification', N)
    render(<FocusAlerts />)
    await act(async () => { fireEvent.click(screen.getByRole('switch', { name: 'Notification' })) })
    expect(focusPrefs.get().notify).toBe(false)
    expect(screen.getByRole('alert').textContent).toMatch(/blocked/)
    N.requestPermission = vi.fn(async () => { N.permission = 'granted'; return 'granted' as const })
    await act(async () => { fireEvent.click(screen.getByRole('switch', { name: 'Notification' })) })
    expect(focusPrefs.get().notify).toBe(true)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('the Focus page', () => {
  const mins = () => screen.getByRole('spinbutton', { name: 'Minutes' })
  const hrs = () => screen.getByRole('spinbutton', { name: 'Hours' })

  it('starts at the length from Settings, and changes it to any length before the session begins', async () => {
    await act(async () => { page() })
    expect(mins().getAttribute('aria-valuenow')).toBe('25')
    expect(screen.queryByRole('button', { name: /Back to/ })).toBeNull()
    await act(async () => { fireEvent.keyDown(mins(), { key: 'PageDown' }) })
    expect(mins().getAttribute('aria-valuenow')).toBe('30')
    await act(async () => { fireEvent.keyDown(hrs(), { key: 'ArrowDown' }) })
    expect(hrs().getAttribute('aria-valuenow')).toBe('1')
    expect(mins().getAttribute('aria-valuenow')).toBe('30')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Back to 25 min' })) })
    expect(mins().getAttribute('aria-valuenow')).toBe('25')
    expect(hrs().getAttribute('aria-valuenow')).toBe('0')
  })

  it('goes back to a Settings length that is not a multiple of five', async () => {
    render(<ProfileProvider initial={{ ...profile, focus_minutes: 33 }}><ToastProvider><FocusProvider><FocusPage /></FocusProvider></ToastProvider></ProfileProvider>)
    await act(async () => {})
    await act(async () => { fireEvent.keyDown(mins(), { key: 'PageUp' }) })
    expect(mins().getAttribute('aria-valuenow')).toBe('28')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Back to 33 min' })) })
    expect(mins().getAttribute('aria-valuenow')).toBe('33')
  })

  it('swaps the drums for the countdown once the session runs', async () => {
    await act(async () => { page() })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start' })) })
    expect(screen.queryByRole('spinbutton')).toBeNull()
    expect(screen.getByText('25:00')).toBeTruthy()
  })

  it('shows the break length on the drums when a break has not started', async () => {
    await act(async () => { page() })
    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Short break' })) })
    expect(mins().getAttribute('aria-valuenow')).toBe('5')
  })

  it('lets the student choose a task, shows it under the clock, and clears it', async () => {
    await act(async () => { page() })
    fireEvent.click(screen.getByRole('button', { name: /What are you working on/ }))
    const list = await screen.findByRole('listbox', { name: 'Open tasks' })
    expect(within(list).getAllByRole('option').map(o => o.textContent)).toEqual(['Nothing in particular', expect.stringContaining('Read chapter 7'), expect.stringContaining('Email supervisor')])
    expect(within(list).getByText('Biology')).toBeTruthy()
    await act(async () => { fireEvent.click(within(list).getByRole('option', { name: /Read chapter 7/ })) })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(focusTaskStore.get()).toMatchObject({ id: 't1', title: 'Read chapter 7', course_id: 'c1', uid: 'u' })
    expect(screen.getAllByText('Read chapter 7').length).toBeGreaterThan(1) // in the picker button and under the clock
    fireEvent.click(screen.getByRole('button', { name: 'Clear the task' }))
    expect(focusTaskStore.get()).toBeNull()
    expect(screen.getByRole('button', { name: /What are you working on/ })).toBeTruthy()
  })

  it('says when there are no open tasks, and closes the list with Escape', async () => {
    listOpenTasks.mockResolvedValue([])
    await act(async () => { page() })
    fireEvent.click(screen.getByRole('button', { name: /What are you working on/ }))
    expect(await screen.findByText(/No open tasks/)).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('has no task picker in a break', async () => {
    await act(async () => { page() })
    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Long break' })) })
    expect(screen.queryByRole('button', { name: /What are you working on/ })).toBeNull()
  })
})
