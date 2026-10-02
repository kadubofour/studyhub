// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'

const deleteNote = vi.fn(async (id: string) => { void id })
const note = (id: string, title: string) => ({ id, title, course_id: null, updated_at: new Date().toISOString() })
let notes = [note('a', 'Krebs cycle'), note('b', 'Mitosis')]
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => [] }))
vi.mock('@/lib/data/notes', () => ({
  listNotes: async () => notes,
  createNote: async () => ({ id: 'n' }),
  searchNotes: async () => [],
  getNotesForExport: async () => [],
  deleteNote: (_sb: unknown, id: string) => deleteNote(id),
}))
const openPdfExport = vi.fn()
vi.mock('@/lib/export/exportNotes', () => ({ exportNotesToWord: vi.fn(async () => true), openPdfExport: (ids: string[]) => openPdfExport(ids) }))
const router = { push: vi.fn(), replace: vi.fn() }
vi.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/notes' }))

import { ToastProvider } from '@/components/providers/ToastProvider'
import { ConfirmProvider } from '@/components/providers/ConfirmProvider'
import { NotesSidebar } from '@/components/notes/NotesSidebar'
import { ProfileProvider } from '@/components/providers/ProfileProvider'
import type { Profile } from '@/lib/types'

const profile = { id: 'u', display_name: null, timezone: 'UTC', daily_goal_minutes: 120, focus_minutes: 25, short_break_minutes: 5, long_break_minutes: 15, long_break_every: 4, default_editor_mode: 'rich', theme: 'system', accent: 'blue', font: 'sans', auto_math: true, onboarded: true } as Profile

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
afterEach(() => { cleanup(); notes = [note('a', 'Krebs cycle'), note('b', 'Mitosis')]; deleteNote.mockClear() })

const renderList = async () => {
  render(<ProfileProvider initial={profile}><ToastProvider><ConfirmProvider><NotesSidebar /></ConfirmProvider></ToastProvider></ProfileProvider>)
  await screen.findByText('Krebs cycle')
}

describe('notes list quick actions', () => {
  it('right-clicking a note opens its quick actions', async () => {
    await renderList()
    await act(async () => { fireEvent.contextMenu(screen.getByRole('link', { name: /Krebs cycle/ }), { clientX: 30, clientY: 40 }) })
    const menu = screen.getByRole('menu', { name: 'Krebs cycle' })
    expect(Array.from(menu.querySelectorAll('[role="menuitem"]')).map(e => e.textContent)).toEqual(
      ['Open', 'Open in new tab', 'Export as Word', 'Export as PDF', 'Select', 'Delete'])
    await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Export as PDF' })) })
    expect(openPdfExport).toHaveBeenCalledWith(['a'])
  })

  it('the ⋯ button opens the same menu (for touch screens)', async () => {
    await renderList()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'More actions for Mitosis' })) })
    expect(screen.getByRole('menu', { name: 'Mitosis' })).toBeTruthy()
  })

  it('Delete asks first, then deletes and removes it from the list', async () => {
    await renderList()
    await act(async () => { fireEvent.contextMenu(screen.getByRole('link', { name: /Krebs cycle/ })) })
    await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' })) })
    expect(deleteNote).not.toHaveBeenCalled()
    notes = [note('b', 'Mitosis')]
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Delete note' })) })
    expect(deleteNote).toHaveBeenCalledWith('a')
    expect(screen.queryByText('Krebs cycle')).toBeNull()
  })

  it('Select starts selecting with that note ticked', async () => {
    await renderList()
    await act(async () => { fireEvent.contextMenu(screen.getByRole('link', { name: /Mitosis/ })) })
    await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Select' })) })
    expect(screen.getByRole('checkbox', { name: 'Select Mitosis' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText('1 selected')).toBeTruthy()
  })
})
