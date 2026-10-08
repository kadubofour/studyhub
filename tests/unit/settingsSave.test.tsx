// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import type { Profile } from '@/lib/types'

let resolveUpdate: ((p: Profile) => void) | null = null
let rejectNext: unknown = null
let lastPatch: Partial<Profile> | null = null
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({ auth: { signOut: async () => ({}) } }) }))
vi.mock('@/lib/data/profile', () => ({
  updateProfile: (_sb: unknown, _id: string, patch: Partial<Profile>) => {
    lastPatch = patch
    if (rejectNext) { const e = rejectNext; rejectNext = null; return Promise.reject(e) }
    if ('accent' in patch) return Promise.resolve({ ...base, ...patch })
    return new Promise(r => { resolveUpdate = r })
  },
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }))

import { ProfileProvider, useProfile } from '@/components/providers/ProfileProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'
import SettingsPage from '@/app/(app)/settings/page'

const base: Profile = { id: 'u', display_name: 'Ama', timezone: 'UTC', daily_goal_minutes: 120, focus_minutes: 25, short_break_minutes: 5, long_break_minutes: 15, long_break_every: 4, default_editor_mode: 'rich', theme: 'system', accent: 'blue', font: 'sans', look: 'classic', auto_math: true, onboarded: true }
function AccentProbe() { return <output data-testid="accent">{useProfile().profile.accent}</output> }

beforeAll(() => {
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia
})
afterEach(cleanup)

const renderPage = () => render(<ProfileProvider initial={base}><ToastProvider><SettingsPage /><AccentProbe /></ToastProvider></ProfileProvider>)

describe('Settings save', () => {
  it('automatic maths can be switched off', async () => {
    renderPage()
    const toggle = screen.getByRole('switch', { name: /Turn typed maths into equations/ })
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    await act(async () => { fireEvent.click(toggle) })
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save changes' })) })
    expect(lastPatch).toEqual({ auto_math: false })
    await act(async () => { resolveUpdate?.({ ...base, auto_math: false }) })
  })

  it('saving the form doesn\'t undo an accent picked while the save was in flight', async () => {
    renderPage()
    fireEvent.change(screen.getByLabelText('Focus length (min)'), { target: { value: '30' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save changes' })) })
    await act(async () => { fireEvent.click(screen.getByRole('radio', { name: 'Teal accent' })) })
    expect(screen.getByTestId('accent').textContent).toBe('teal')
    // The form save answers with a row read before the accent change reached the database
    await act(async () => { resolveUpdate!({ ...base, focus_minutes: 30 }) })
    expect(screen.getByTestId('accent').textContent).toBe('teal')
  })

  it('explains an unsupported time zone instead of a generic error', async () => {
    renderPage()
    rejectNext = Object.assign(new Error('invalid time zone'), { code: '22023' })
    fireEvent.change(screen.getByLabelText('Focus length (min)'), { target: { value: '31' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save changes' })) })
    expect(screen.getByRole('alert').textContent).toMatch(/time zone isn't supported/)
  })
})
