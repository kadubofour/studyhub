// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'
import type { Profile } from '@/lib/types'

const logFocusSession = vi.fn(async (..._a: unknown[]) => {})
vi.mock('@/lib/data/focus', () => ({ logFocusSession: (...a: unknown[]) => logFocusSession(...a), listSessionsSince: async () => [] }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/focus/alert', () => ({ chime: vi.fn(), vibrate: vi.fn(), notify: vi.fn(), primeAudio: vi.fn(), audioContext: () => null }))

import { ProfileProvider } from '@/components/providers/ProfileProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'
import { FocusProvider } from '@/components/providers/FocusProvider'
import FocusPage from '@/app/(app)/focus/page'
import { ambientPrefs, DEFAULT_AMBIENT } from '@/lib/focus/ambientPrefs'
import { focusPrefs, DEFAULT_PREFS } from '@/lib/focus/prefs'

const profile: Profile = {
  id: 'u', display_name: 'Ama', school: null, programme: null, avatar_color: '#3B5BDB', timezone: 'UTC', daily_goal_minutes: 120, focus_minutes: 25,
  short_break_minutes: 5, long_break_minutes: 15, long_break_every: 4, default_editor_mode: 'rich',
  theme: 'system', accent: 'blue', font: 'sans', look: 'classic', content_width: 'wide', auto_math: true, onboarded: true,
}
const page = () => render(<ProfileProvider initial={profile}><ToastProvider><FocusProvider><FocusPage /></FocusProvider></ToastProvider></ProfileProvider>)
const press = (key: string, target: Element = document.body) => act(async () => { fireEvent.keyDown(target, { key }) })

const realFullscreen = { request: document.documentElement.requestFullscreen, exit: document.exitFullscreen }
beforeEach(() => { window.localStorage.clear(); ambientPrefs.set(DEFAULT_AMBIENT); focusPrefs.set(DEFAULT_PREFS); logFocusSession.mockClear() })
afterEach(() => { cleanup(); document.documentElement.requestFullscreen = realFullscreen.request; document.exitFullscreen = realFullscreen.exit; Reflect.deleteProperty(document, 'fullscreenElement') })

describe('Focus page sounds', () => {
  it('choosing a sound and a volume is kept, for the app layout to play', async () => {
    await act(async () => { page() })
    expect(screen.getByRole('button', { name: 'Off' }).getAttribute('aria-pressed')).toBe('true')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Rain' })) })
    expect(ambientPrefs.get().sound).toBe('rain')
    expect(screen.getByRole('button', { name: 'Rain' }).getAttribute('aria-pressed')).toBe('true')
    await act(async () => { fireEvent.change(screen.getByLabelText('Volume'), { target: { value: '0.3' } }) })
    expect(ambientPrefs.get()).toEqual({ sound: 'rain', volume: 0.3 })
  })

  it('shows the kept sound when the page is opened again', async () => {
    ambientPrefs.set({ sound: 'lofi', volume: 0.2 })
    await act(async () => { page() })
    expect(screen.getByRole('button', { name: 'Lo-fi' }).getAttribute('aria-pressed')).toBe('true')
    expect((screen.getByLabelText('Volume') as HTMLInputElement).value).toBe('0.2')
  })

  it('draws the volume slider in the accent colour', async () => {
    await act(async () => { page() })
    expect(screen.getByLabelText('Volume').className).toContain('accent-[var(--accent-solid)]')
  })
})

describe('Focus page keyboard shortcuts', () => {
  it('Space starts and pauses, R restarts, S skips', async () => {
    await act(async () => { page() })
    await press(' ')
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy()
    await press(' ')
    expect(screen.getByRole('button', { name: 'Resume' })).toBeTruthy()
    await press('r')
    expect(screen.getByRole('button', { name: 'Start' })).toBeTruthy() // back at the full time, stopped
    await press('s')
    expect(screen.getByRole('tab', { name: 'Short break', selected: true })).toBeTruthy()
  })

  it('R does nothing before any time has gone', async () => {
    await act(async () => { page() })
    await press('r')
    expect(screen.getByRole('button', { name: 'Start' })).toBeTruthy()
    expect(screen.getByRole('spinbutton', { name: 'Minutes' }).getAttribute('aria-valuenow')).toBe('25')
  })

  it('keys typed in a field or on a control that takes them are left alone', async () => {
    await act(async () => { page() })
    await press(' ', screen.getByRole('button', { name: 'Rain' })) // Space on a button presses the button
    expect(screen.getByRole('button', { name: 'Start' })).toBeTruthy()
    await press('s', screen.getByLabelText('Volume')) // the slider is a field
    expect(screen.getByRole('tab', { name: 'Focus', selected: true })).toBeTruthy()
  })

  it('works from the drums', async () => {
    await act(async () => { page() })
    await press(' ', screen.getByRole('spinbutton', { name: 'Minutes' }))
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy()
  })

  it('does not put a list of the keys on the page', async () => {
    await act(async () => { page() })
    expect(screen.queryByText(/Space start or pause/)).toBeNull()
  })
})

describe('Focus page full screen', () => {
  it('keeps Tab inside the view, and gives focus back to the button that opened it', async () => {
    await act(async () => { page() })
    const opener = screen.getByRole('button', { name: 'Full screen' })
    opener.focus()
    await act(async () => { fireEvent.click(opener) })
    const view = screen.getByRole('dialog', { name: 'Full screen timer' })
    const inside = within(view).getAllByRole('button')
    expect(document.activeElement).toBe(within(view).getByRole('button', { name: 'Start' })) // starts on the main control
    inside[inside.length - 1].focus()
    await act(async () => { fireEvent.keyDown(inside[inside.length - 1], { key: 'Tab' }) })
    expect(view.contains(document.activeElement)).toBe(true)
    expect(document.activeElement).toBe(inside[0])
    inside[0].focus()
    await act(async () => { fireEvent.keyDown(inside[0], { key: 'Tab', shiftKey: true }) })
    expect(document.activeElement).toBe(inside[inside.length - 1])
    document.querySelector<HTMLElement>('main, body')!.focus()
    await act(async () => { fireEvent.click(within(view).getByRole('button', { name: 'Exit full screen' })) })
    expect(document.activeElement).toBe(opener)
  })

  it('opens from the button, shows the timer large with its controls, and closes with Exit', async () => {
    await act(async () => { page() })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Full screen' })) })
    const view = screen.getByRole('dialog', { name: 'Full screen timer' })
    expect(view.textContent).toContain('25:00')
    expect(view.textContent).toContain('Session 1 of 4')
    await act(async () => { fireEvent.click(within(view).getByRole('button', { name: 'Start' })) })
    expect(within(view).getByRole('button', { name: 'Pause' })).toBeTruthy() // the controls work from the full screen view
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Exit full screen' })) })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens and closes with F, and closes with Escape', async () => {
    await act(async () => { page() })
    await press('f')
    expect(screen.getByRole('dialog', { name: 'Full screen timer' })).toBeTruthy()
    await press('f')
    expect(screen.queryByRole('dialog')).toBeNull()
    await press('f')
    await press('Escape')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('asks the browser for real full screen, and leaves it when closed', async () => {
    const request = vi.fn(async () => {})
    const exit = vi.fn(async () => {})
    document.documentElement.requestFullscreen = request
    document.exitFullscreen = exit
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => document.documentElement })
    await act(async () => { page() })
    await press('f')
    expect(request).toHaveBeenCalled()
    await press('Escape')
    expect(exit).toHaveBeenCalled()
    Reflect.deleteProperty(document, 'fullscreenElement')
  })

  it('closes when the browser leaves full screen by itself', async () => {
    document.documentElement.requestFullscreen = async () => {}
    let el: Element | null = document.documentElement
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => el })
    await act(async () => { page() })
    await press('f')
    el = null
    await act(async () => { document.dispatchEvent(new Event('fullscreenchange')) })
    expect(screen.queryByRole('dialog')).toBeNull()
    Reflect.deleteProperty(document, 'fullscreenElement')
  })
})
