// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'

const note = (id: string, title: string, notebook_id: string | null = null) => ({ id, title, course_id: null, updated_at: new Date().toISOString(), notebook_id })
let notes = [note('a', 'Krebs cycle', 'b1'), note('b', 'Mitosis', 'b1'), note('c', 'Newton', 'b2'), note('d', 'Loose note')]
let books = [{ id: 'b1', name: 'Biology' }, { id: 'b2', name: 'Physics' }]
const createNote = vi.fn(async (..._a: unknown[]) => ({ id: 'n' }))
const createNotebook = vi.fn(async (_sb: unknown, name: string) => { const b = { id: 'b3', name }; books = [...books, b]; return b })
const renameNotebook = vi.fn(async (..._a: unknown[]) => {})
const deleteNotebook = vi.fn(async (..._a: unknown[]) => {})
const moveNotes = vi.fn(async (..._a: unknown[]) => {})
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => [] }))
vi.mock('@/lib/data/notes', () => ({
  listNotes: async () => notes, createNote: (...a: unknown[]) => createNote(...a), searchNotes: async () => [], getNotesForExport: async () => [], deleteNote: vi.fn(),
}))
vi.mock('@/lib/data/notebooks', () => ({
  listNotebooks: async () => books,
  createNotebook: (sb: unknown, name: string) => createNotebook(sb, name),
  renameNotebook: (...a: unknown[]) => renameNotebook(...a),
  deleteNotebook: (...a: unknown[]) => deleteNotebook(...a),
  moveNotes: (...a: unknown[]) => moveNotes(...a),
}))
vi.mock('@/lib/export/exportNotes', () => ({ exportNotesToWord: vi.fn(async () => true), openPdfExport: vi.fn() }))
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
beforeEach(() => {
  notes = [note('a', 'Krebs cycle', 'b1'), note('b', 'Mitosis', 'b1'), note('c', 'Newton', 'b2'), note('d', 'Loose note')]
  books = [{ id: 'b1', name: 'Biology' }, { id: 'b2', name: 'Physics' }]
  for (const f of [createNote, createNotebook, renameNotebook, deleteNotebook, moveNotes]) f.mockClear()
})
afterEach(cleanup)
const open = async () => {
  await act(async () => { render(<ProfileProvider initial={profile}><ToastProvider><ConfirmProvider><NotesSidebar /></ConfirmProvider></ToastProvider></ProfileProvider>) })
  await screen.findByText('Krebs cycle')
}
const titles = () => screen.getAllByRole('link').map(l => l.querySelector('[data-title]')?.textContent)
const layoutOf = () => screen.getByRole('list', { name: 'Notes' }).getAttribute('data-layout')
beforeEach(() => localStorage.clear())

describe('how the notes are shown', () => {
  it('is a grid, newest edit first, until the student chooses otherwise; the choice is remembered', async () => {
    notes = [note('a', 'Krebs cycle'), note('b', 'atoms'), note('c', 'Mitosis')].map((n, i) => ({ ...n, updated_at: `2026-10-0${3 - i}T00:00:00Z` }))
    await open()
    expect(layoutOf()).toBe('grid')
    expect(titles()).toEqual(['Krebs cycle', 'atoms', 'Mitosis'])
    fireEvent.click(screen.getByRole('radio', { name: 'List' }))
    expect(layoutOf()).toBe('list')
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'title' } })
    expect(titles()).toEqual(['atoms', 'Krebs cycle', 'Mitosis'])
    cleanup()
    await open()
    expect(layoutOf()).toBe('list')
    expect((screen.getByLabelText('Sort by') as HTMLSelectElement).value).toBe('title')
  })
})

describe('notes as icons', () => {
  it('shows each note as a big icon with its name, with the same tile as the other pages', async () => {
    await open()
    fireEvent.click(screen.getByRole('radio', { name: 'Icons' }))
    expect(screen.getByRole('list', { name: 'Notes' }).getAttribute('data-layout')).toBe('icons')
    const link = screen.getByRole('link', { name: /Krebs cycle/ })
    expect(link.getAttribute('title')).toBe('Krebs cycle')
    expect(link.querySelector('[data-icon]')).toBeTruthy()
    expect(screen.getAllByRole('listitem').length).toBe(screen.getAllByRole('link').length)
  })
})
