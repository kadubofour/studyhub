// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'

const pending: Record<string, (v: { id: string; title: string; course_id: null; updated_at: string }[]) => void> = {}
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => [] }))
vi.mock('@/lib/data/notes', () => ({
  listNotes: async () => [],
  createNote: async () => ({ id: 'n' }),
  searchNotes: (_sb: unknown, q: string) => new Promise(r => { pending[q] = r }),
  getNotesForExport: async () => [],
}))
const router = { push: vi.fn(), replace: vi.fn() }
vi.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/notes' }))

import { ToastProvider } from '@/components/providers/ToastProvider'
import { ProfileProvider } from '@/components/providers/ProfileProvider'
import { NotesSidebar } from '@/components/notes/NotesSidebar'
import type { Profile } from '@/lib/types'

const profile = { id: 'u', display_name: null, timezone: 'UTC', daily_goal_minutes: 120, focus_minutes: 25, short_break_minutes: 5, long_break_minutes: 15, long_break_every: 4, default_editor_mode: 'rich', theme: 'system', accent: 'blue', font: 'sans', auto_math: true, onboarded: true } as Profile
const note = (id: string, title: string) => ({ id, title, course_id: null, updated_at: new Date().toISOString() })

beforeAll(() => { HTMLDialogElement.prototype.showModal = function () {}; HTMLDialogElement.prototype.close = function () {} })
afterEach(cleanup)

describe('notes search', () => {
  it('a slow earlier search result does not replace the newer one', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    render(<ProfileProvider initial={profile}><ToastProvider><NotesSidebar /></ToastProvider></ProfileProvider>)
    const box = screen.getByLabelText('Search notes')
    await act(async () => { fireEvent.change(box, { target: { value: 'kre' } }); vi.advanceTimersByTime(300) })
    await act(async () => { fireEvent.change(box, { target: { value: 'krebs' } }); vi.advanceTimersByTime(300) })
    await act(async () => { pending['krebs']([note('b', 'Krebs cycle')]) })
    await act(async () => { pending['kre']([note('a', 'Old result')]) }) // arrives late
    vi.useRealTimers()
    expect(screen.queryByText('Old result')).toBeNull()
    expect(screen.getByText('Krebs cycle')).toBeTruthy()
  })
})
