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


describe('one design', () => {
  it('has no Look picker: accent, font and width are the choices', () => {
    open()
    expect(screen.queryByRole('radiogroup', { name: 'Look' })).toBeNull()
    for (const name of ['Content width', 'Accent colour']) expect(screen.getByRole('radiogroup', { name })).toBeTruthy()
  })
})
