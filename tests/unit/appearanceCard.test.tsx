// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderToString } from 'react-dom/server'
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

describe('Look picker', () => {
  it('shows Classic and Paper and marks the current one', () => {
    open()
    expect(screen.getByRole('radiogroup', { name: 'Look' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Classic look' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: 'Paper look' }).getAttribute('aria-checked')).toBe('false')
    expect(screen.getByText('Warm cream, softer edges')).toBeTruthy()
  })
  it('applies the new look at once and saves it', async () => {
    open()
    await act(async () => { fireEvent.click(screen.getByRole('radio', { name: 'Paper look' })) })
    expect(screen.getByTestId('look').textContent).toBe('paper')
    expect(updateProfile).toHaveBeenCalledWith(expect.anything(), 'u', { look: 'paper' })
    expect(screen.getByRole('radio', { name: 'Paper look' }).getAttribute('aria-checked')).toBe('true')
  })
  it('goes back to the previous look when saving fails', async () => {
    failing = true
    open()
    await act(async () => { fireEvent.click(screen.getByRole('radio', { name: 'Paper look' })) })
    expect(screen.getByTestId('look').textContent).toBe('classic')
    expect(screen.getByRole('radio', { name: 'Classic look' }).getAttribute('aria-checked')).toBe('true')
  })
  it('works from the keyboard like Accent and Font', async () => {
    open()
    await act(async () => { fireEvent.keyDown(screen.getByRole('radio', { name: 'Classic look' }), { key: 'ArrowRight' }) })
    expect(screen.getByTestId('look').textContent).toBe('paper')
  })
  it('an old profile without a look shows Classic selected', () => {
    const old = { ...base } as Record<string, unknown>
    delete old.look
    open(old as unknown as Profile)
    expect(screen.getByRole('radio', { name: 'Classic look' }).getAttribute('aria-checked')).toBe('true')
  })
  it('a failed accent save does not undo a look that was saved meanwhile', async () => {
    let rejectFirst: (e: Error) => void = () => {}
    let calls = 0
    impl = () => (++calls === 1 ? new Promise((_, rej) => { rejectFirst = rej }) : Promise.resolve({}))
    open()
    await act(async () => { fireEvent.click(screen.getByRole('radio', { name: 'Coral accent' })) })
    await act(async () => { fireEvent.click(screen.getByRole('radio', { name: 'Paper look' })) })
    await act(async () => { rejectFirst(new Error('offline')) })
    expect(screen.getByTestId('look').textContent).toBe('paper')
    expect(screen.getByRole('radio', { name: 'Blue accent' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: 'Coral accent' }).getAttribute('aria-checked')).toBe('false')
  })
  it('the previews are drawn light on the server even when the theme is dark, so hydration matches', () => {
    resolved = 'dark' // what the browser's first render reads; the server cannot know it
    const html = renderToString(<ToastProvider><ProfileProvider initial={base}><AppearanceCard /></ProfileProvider></ToastProvider>)
    expect(html).toContain('#fbfbfa') // Classic light background
    expect(html).not.toContain('#121211') // Classic dark background
  })
})
