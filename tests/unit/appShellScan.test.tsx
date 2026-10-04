// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type { Profile } from '@/lib/types'

let path = '/planner'
vi.mock('next/navigation', () => ({ usePathname: () => path, useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }))
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }) }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/components/scan/ScanDialog', () => ({
  ScanDialog: (p: { initialTarget: string; onSaved?: () => void; onClose: () => void }) => (
    <div role="dialog">scan {p.initialTarget}<button onClick={p.onSaved}>saved</button><button onClick={p.onClose}>close</button></div>
  ),
}))

import { ProfileProvider } from '@/components/providers/ProfileProvider'
import { AppShell } from '@/components/shell/AppShell'
import { SCAN_SAVED } from '@/lib/scan/events'

const profile = { id: 'u1', display_name: null, timezone: 'Africa/Accra', daily_goal_minutes: 120, focus_minutes: 25, short_break_minutes: 5, long_break_minutes: 15, long_break_every: 4, default_editor_mode: 'rich', theme: 'system', accent: 'blue', font: 'sans', auto_math: true, onboarded: true } as Profile
const renderShell = () => render(<ProfileProvider initial={profile}><AppShell><p>page</p></AppShell></ProfileProvider>)
afterEach(() => cleanup())

describe('Scan in the app shell', () => {
  it('has a Scan button in the sidebar and in the phone tab bar', () => {
    path = '/home'
    renderShell()
    expect(screen.getAllByRole('button', { name: 'Scan' })).toHaveLength(2)
  })

  it.each([
    ['/planner', 'planner'], ['/flashcards', 'cards'], ['/flashcards/d1', 'cards'], ['/review', 'cards'], ['/notes', 'note'], ['/home', 'note'],
  ])('on %s, Scan starts on %s', (at, target) => {
    path = at
    renderShell()
    fireEvent.click(screen.getAllByRole('button', { name: 'Scan' })[0])
    expect(screen.getByRole('dialog').textContent).toContain(`scan ${target}`)
  })

  it('saving a scan tells the page to refresh, and closing removes the dialog', () => {
    path = '/planner'
    const heard = vi.fn()
    window.addEventListener(SCAN_SAVED, heard)
    renderShell()
    fireEvent.click(screen.getAllByRole('button', { name: 'Scan' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'saved' }))
    expect(heard).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    window.removeEventListener(SCAN_SAVED, heard)
  })
})
