// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import type { Profile } from '@/lib/types'

const updateProfile = vi.fn(async (..._a: unknown[]) => ({}))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
let impl: ((...a: unknown[]) => Promise<unknown>) | null = null
let failing = false // fails through a plain function: vitest's spy would report its own rejected result as unhandled
vi.mock('@/lib/data/profile', () => ({ updateProfile: (...a: unknown[]) => (impl ? impl(...a) : failing ? Promise.reject(new Error('offline')) : updateProfile(...a)) }))
let resolved = 'light'
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: resolved, setTheme: vi.fn() }) }))
import { ProfileProvider, useProfile } from '@/components/providers/ProfileProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'
import { AppearanceCard } from '@/components/settings/AppearanceCard'
import { choose, optionsOf, shown } from './dropdown'

const base = { id: 'u', display_name: 'Ama', timezone: 'UTC', daily_goal_minutes: 120, focus_minutes: 25, short_break_minutes: 5, long_break_minutes: 15, long_break_every: 4, default_editor_mode: 'rich', theme: 'system', accent: 'blue', font: 'sans', look: 'classic', auto_math: true, onboarded: true } as Profile
function Look() { return <output data-testid="look">{useProfile().profile.look}</output> }
const open = (p: Profile = base) => render(<ToastProvider><ProfileProvider initial={p}><AppearanceCard /><Look /></ProfileProvider></ToastProvider>)
beforeEach(() => { impl = null; resolved = 'light'; failing = false; updateProfile.mockReset().mockResolvedValue({}) })
afterEach(cleanup)

describe('Content width', () => {
  it('offers Focused, Wide and Full, with the current one chosen', () => {
    open({ ...base, content_width: 'full' } as Profile)
    const group = screen.getByRole('radiogroup', { name: 'Content width' })
    expect(group).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Full' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: 'Wide' }).getAttribute('aria-checked')).toBe('false')
  })
  it('an old profile without a choice shows Wide', () => {
    open(base)
    expect(screen.getByRole('radio', { name: 'Wide' }).getAttribute('aria-checked')).toBe('true')
  })
  it('applies the choice at once and saves it', async () => {
    open(base)
    await act(async () => { fireEvent.click(screen.getByRole('radio', { name: 'Focused' })) })
    expect(updateProfile).toHaveBeenCalledWith(expect.anything(), 'u', { content_width: 'focused' })
    expect(screen.getByRole('radio', { name: 'Focused' }).getAttribute('aria-checked')).toBe('true')
  })
})


describe('Look picker', () => {
  it('is a dropdown: Classic first, then Studio, Paper, Vivid and Playful, each with its line, and the current one shown', () => {
    open()
    expect(shown('Look')).toContain('Classic')
    expect(optionsOf('Look')).toEqual(['ClassicWarm paper, black ink buttons, serif titles', 'StudioCool midnight blue, clean sans titles',
      'PaperCream pages and a bookish serif', 'VividYour colour on the buttons and choices', 'PlayfulSunny, bold outlines, buttons you press in'])
  })
  it('applies the new look at once and saves it', async () => {
    open()
    choose('Look', /^Studio/); await act(async () => {})
    expect(screen.getByTestId('look').textContent).toBe('studio')
    expect(updateProfile).toHaveBeenCalledWith(expect.anything(), 'u', { look: 'studio' })
  })
  it('goes back to the previous look when saving fails', async () => {
    failing = true
    open()
    choose('Look', /^Paper/); await act(async () => {})
    expect(screen.getByTestId('look').textContent).toBe('classic')
  })
  it('works from the keyboard: open with Enter, move with the arrows, choose with Enter', async () => {
    open()
    const button = screen.getByRole('button', { name: 'Look' })
    fireEvent.keyDown(button, { key: 'Enter' })
    fireEvent.keyDown(button, { key: 'ArrowDown' })
    await act(async () => { fireEvent.keyDown(button, { key: 'Enter' }) })
    expect(screen.getByTestId('look').textContent).toBe('studio')
    expect(screen.queryByRole('listbox')).toBeNull()
  })
  it('an old profile without a look shows Classic', () => {
    const old = { ...base } as Record<string, unknown>
    delete old.look
    open(old as unknown as Profile)
    expect(shown('Look')).toContain('Classic')
  })
  it('Paper has its own dark mode: in dark mode it is offered, and a saved Paper stays Paper', async () => {
    resolved = 'dark'
    open({ ...base, look: 'paper' })
    expect(shown('Look')).toContain('Paper')
    expect(optionsOf('Look').some(o => o.startsWith('Paper'))).toBe(true)
    choose('Look', /^Studio/); await act(async () => {})
    expect(updateProfile).toHaveBeenCalledWith(expect.anything(), 'u', { look: 'studio' })
  })
})

describe('the look preview', () => {
  it('draws a small app in the chosen look itself: its sidebar, a title, a card, a chosen chip and both buttons', async () => {
    open()
    for (const look of ['classic', 'studio', 'paper', 'vivid', 'playful']) {
      if (look !== 'classic') choose('Look', new RegExp('^' + look, 'i')); await act(async () => {})
      const preview = document.querySelector('[data-look-preview]') as HTMLElement
      expect(preview.getAttribute('data-look')).toBe(look)
      expect(preview.classList.contains('app-root')).toBe(true) // so the look's own colours and shapes apply
      expect(preview.getAttribute('aria-hidden')).toBe('true')
      for (const sel of ['.app-sidebar', '.card', '.btn-primary', '.btn', '.font-display']) expect(preview.querySelector(sel), `${look} ${sel}`).toBeTruthy()
    }
  })
  it('uses the look\'s own title face unless the student chose a font', () => {
    open()
    const preview = document.querySelector('[data-look-preview]') as HTMLElement
    expect(preview.style.getPropertyValue('--display-font')).toBe('var(--title-font, var(--font-instrument))')
  })
})

describe('Theme', () => {
  it('starts Appearance with System, Light and Dark as pictures, and applies and saves a choice', async () => {
    open()
    expect(screen.getByRole('radio', { name: 'System' }).getAttribute('aria-checked')).toBe('true')
    await act(async () => { fireEvent.click(screen.getByRole('radio', { name: 'Dark' })) })
    expect(updateProfile).toHaveBeenCalledWith(expect.anything(), 'u', { theme: 'dark' })
    expect(screen.getByRole('radio', { name: 'Dark' }).getAttribute('aria-checked')).toBe('true')
  })
})
