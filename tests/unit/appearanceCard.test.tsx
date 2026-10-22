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
  it('offers Studio first, then the older looks, and marks the current one', () => {
    open()
    const names = screen.getAllByRole('radio').filter(r => r.getAttribute('aria-label')?.endsWith(' look')).map(r => r.getAttribute('aria-label'))
    expect(names).toEqual(['Studio look', 'Classic look', 'Paper look', 'Vivid look', 'Playful look'])
    expect(screen.getByRole('radio', { name: 'Classic look' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText('Warm cream, softer edges')).toBeTruthy()
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
    expect(screen.getByTestId('look').textContent).toBe('paper')
  })
  it('an old profile without a look shows Studio selected', () => {
    const old = { ...base } as Record<string, unknown>
    delete old.look
    open(old as unknown as Profile)
    expect(screen.getByRole('radio', { name: 'Studio look' }).getAttribute('aria-checked')).toBe('true')
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
