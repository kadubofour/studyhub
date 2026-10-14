// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'
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
let search = ''
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }), useSearchParams: () => new URLSearchParams(search) }))

import { ProfileProvider, useProfile } from '@/components/providers/ProfileProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'
import SettingsPage from '@/app/(app)/settings/page'
import { PreferencesCard } from '@/components/profile/PreferencesCard'
import { AppearanceCard } from '@/components/settings/AppearanceCard'

const base: Profile = { id: 'u', display_name: 'Ama', school: null, programme: null, avatar_color: '#3B5BDB', timezone: 'UTC', daily_goal_minutes: 120, focus_minutes: 25, short_break_minutes: 5, long_break_minutes: 15, long_break_every: 4, default_editor_mode: 'rich', theme: 'system', accent: 'blue', font: 'sans', look: 'classic', content_width: 'wide', auto_math: true, onboarded: true }
function AccentProbe() { return <output data-testid="accent">{useProfile().profile.accent}</output> }

beforeAll(() => {
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia
})
afterEach(cleanup)

const renderPage = () => render(<ProfileProvider initial={base}><ToastProvider><PreferencesCard /><AppearanceCard /><AccentProbe /></ToastProvider></ProfileProvider>)

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

describe('Preferences follow the theme toggled elsewhere', () => {
  it('shows the theme chosen with the sidebar button, so saving System afterwards really saves it', async () => {
    function Toggle() { const { setProfile } = useProfile(); return <button onClick={() => setProfile(p => ({ ...p, theme: 'dark' }))}>sidebar dark</button> }
    render(<ProfileProvider initial={base}><ToastProvider><PreferencesCard /><Toggle /></ToastProvider></ProfileProvider>)
    const theme = screen.getByRole('radiogroup', { name: 'Theme' })
    expect(within(theme).getByRole('radio', { name: 'System' }).getAttribute('aria-checked')).toBe('true')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'sidebar dark' })) })
    expect(within(theme).getByRole('radio', { name: 'Dark' }).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(within(theme).getByRole('radio', { name: 'System' }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save changes' })) })
    expect(lastPatch).toEqual({ theme: 'system' })
  })
})

describe('Settings page', () => {
  const page = (q = '') => { search = q; return render(<ProfileProvider initial={base}><ToastProvider><SettingsPage /></ToastProvider></ProfileProvider>) }
  it('opens on Appearance, with the sections beside it, and no longer holds the profile and focus form', () => {
    page()
    expect(screen.getByRole('navigation', { name: 'Settings sections' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Appearance' })).toBeTruthy()
    expect(screen.getByRole('radiogroup', { name: 'Look' })).toBeTruthy()
    expect(screen.queryByLabelText('Focus length (min)')).toBeNull()
    expect(screen.queryByText('Profile and focus')).toBeNull()
  })
  it('shows one section at a time: Account has Sign out, the profile pointer and the legal links', () => {
    page()
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Account' }))
    expect(screen.getByRole('heading', { name: 'Account' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Terms' }).getAttribute('href')).toBe('/terms')
    expect(screen.getByRole('link', { name: 'Privacy' }).getAttribute('href')).toBe('/privacy')
    expect(screen.getByText(/light or dark mode/i)).toBeTruthy()
    expect(screen.queryByRole('radiogroup', { name: 'Look' })).toBeNull()
  })
  it('can open on a section named in the address', () => {
    page('section=account')
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy()
  })
  it('falls back to Appearance for a section that does not exist', () => {
    page('section=nonsense')
    expect(screen.getByRole('radiogroup', { name: 'Look' })).toBeTruthy()
  })
  it('has Your data with the download and delete options', () => {
    page()
    fireEvent.click(screen.getByRole('button', { name: 'Your data' }))
    expect(screen.getByRole('button', { name: 'Download my data' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete my account' })).toBeTruthy()
  })
})
