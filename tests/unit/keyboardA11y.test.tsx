// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import type { Profile } from '@/lib/types'

vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/profile', () => ({ updateProfile: async (_sb: unknown, _id: string, p: object) => p }))
vi.mock('@/lib/data/notes', () => ({ getNotesForExport: async () => [] }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => [] }))

import { ProfileProvider } from '@/components/providers/ProfileProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'
import { AppearanceCard } from '@/components/settings/AppearanceCard'
import { ExportMenu } from '@/components/notes/ExportMenu'

const profile: Profile = {
  id: 'u', display_name: 'Ama', timezone: 'UTC', daily_goal_minutes: 120, focus_minutes: 25,
  short_break_minutes: 5, long_break_minutes: 15, long_break_every: 4, default_editor_mode: 'rich',
  theme: 'system', accent: 'blue', font: 'sans', look: 'classic', auto_math: true, onboarded: true,
}
const wrap = (ui: React.ReactNode) => render(<ProfileProvider initial={profile}><ToastProvider>{ui}</ToastProvider></ProfileProvider>)
afterEach(cleanup)

describe('accent and font pickers (ARIA radio groups)', () => {
  it('only the chosen option is in the Tab order, and arrow keys move and choose', async () => {
    wrap(<AppearanceCard />)
    const blue = screen.getByRole('radio', { name: 'Blue accent' })
    const violet = screen.getByRole('radio', { name: 'Violet accent' })
    expect(blue.tabIndex).toBe(0)
    expect(violet.tabIndex).toBe(-1)
    blue.focus()
    await act(async () => { fireEvent.keyDown(blue, { key: 'ArrowRight' }) })
    expect(document.activeElement).toBe(violet)
    expect(violet.getAttribute('aria-checked')).toBe('true')
    await act(async () => { fireEvent.keyDown(violet, { key: 'ArrowLeft' }) })
    expect(screen.getByRole('radio', { name: 'Blue accent' }).getAttribute('aria-checked')).toBe('true')
  })
})

describe('export menu', () => {
  it('moves focus into the menu, supports arrow keys, and Esc returns focus to the button', async () => {
    wrap(<ExportMenu ids={['n1']} />)
    const button = screen.getByRole('button', { name: 'Export' })
    await act(async () => { fireEvent.click(button) })
    const items = screen.getAllByRole('menuitem')
    expect(document.activeElement).toBe(items[0])
    await act(async () => { fireEvent.keyDown(items[0], { key: 'ArrowDown' }) })
    expect(document.activeElement).toBe(items[1])
    await act(async () => { fireEvent.keyDown(items[1], { key: 'ArrowDown' }) })
    expect(document.activeElement).toBe(items[0]) // wraps around
    const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    await act(async () => { items[0].dispatchEvent(esc) })
    expect(esc.defaultPrevented).toBe(true) // so the full-screen editor doesn't also close
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(button)
  })
})
