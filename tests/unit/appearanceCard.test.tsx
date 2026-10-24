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
  it('offers Classic first, then Studio, Paper, Vivid and Playful, and marks the current one', () => {
    open()
    const names = screen.getAllByRole('radio').filter(r => r.getAttribute('aria-label')?.endsWith(' look')).map(r => r.getAttribute('aria-label'))
    expect(names).toEqual(['Classic look', 'Studio look', 'Paper look', 'Vivid look', 'Playful look'])
    expect(screen.getByRole('radio', { name: 'Classic look' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText('Cream pages and a bookish serif')).toBeTruthy()
  })
  it('applies the new look at once and saves it', async () => {
    open()
    await act(async () => { fireEvent.click(screen.getByRole('radio', { name: 'Studio look' })) })
    expect(screen.getByTestId('look').textContent).toBe('studio')
    expect(updateProfile).toHaveBeenCalledWith(expect.anything(), 'u', { look: 'studio' })
  })
  it('goes back to the previous look when saving fails', async () => {
    failing = true
    open()
    await act(async () => { fireEvent.click(screen.getByRole('radio', { name: 'Paper look' })) })
    expect(screen.getByTestId('look').textContent).toBe('classic')
  })
  it('works from the keyboard like Accent and Font', async () => {
    open()
    await act(async () => { fireEvent.keyDown(screen.getByRole('radio', { name: 'Classic look' }), { key: 'ArrowRight' }) })
    expect(screen.getByTestId('look').textContent).toBe('studio')
  })
  it('an old profile without a look shows Classic selected', () => {
    const old = { ...base } as Record<string, unknown>
    delete old.look
    open(old as unknown as Profile)
    expect(screen.getByRole('radio', { name: 'Classic look' }).getAttribute('aria-checked')).toBe('true')
  })
  it('Paper is for light mode: in dark mode it is not offered and a saved Paper shows as Classic, kept', async () => {
    resolved = 'dark'
    open({ ...base, look: 'paper' })
    expect(screen.queryByRole('radio', { name: 'Paper look' })).toBeNull()
    expect(screen.getByRole('radio', { name: 'Classic look' }).getAttribute('aria-checked')).toBe('true')
    await act(async () => { fireEvent.click(screen.getByRole('radio', { name: 'Classic look' })) })
    expect(updateProfile).not.toHaveBeenCalled()
    expect(screen.getByTestId('look').textContent).toBe('paper')
  })
})

describe('the look previews', () => {
  it('draw a small app in each look itself: its sidebar, a title, a card, a chosen chip and both buttons', () => {
    open()
    for (const look of ['classic', 'studio', 'paper', 'vivid', 'playful']) {
      const radio = screen.getByRole('radio', { name: new RegExp('^' + look + ' look', 'i') })
      const preview = radio.querySelector('[data-look-preview]') as HTMLElement
      expect(preview.getAttribute('data-look')).toBe(look)
      expect(preview.classList.contains('app-root')).toBe(true) // so the look's own colours and shapes apply
      expect(preview.getAttribute('aria-hidden')).toBe('true')
      for (const sel of ['.app-sidebar', '.card', '.btn-primary', '.btn', '.font-display']) expect(preview.querySelector(sel), `${look} ${sel}`).toBeTruthy()
    }
  })
  it('use the look\'s own title face unless the student chose a font', () => {
    open()
    const preview = screen.getByRole('radio', { name: /^Classic look/ }).querySelector('[data-look-preview]') as HTMLElement
    expect(preview.style.getPropertyValue('--display-font')).toBe('var(--title-font, var(--font-instrument))')
  })
})
