// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react'

let lectures: Record<string, unknown>[] = []
let used = 0
let leftover: Record<string, unknown>[] = []
const finishRecording = vi.fn(async () => ({ id: 'L9' }))
const push = vi.fn()
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => [{ id: 'c1', name: 'Biology', color: '#1D9E75' }] }))
let usedFails = false
const full = { id: 'L1', course_id: 'c1', title: 'Krebs cycle', parts: [{ path: 'u1/L1-0.webm', start: 0, duration: 60, bytes: 1, transcribed: false }], transcript: [{ start: 0, end: 2, text: 'Welcome.' }] }
const updateLecture = vi.fn(async (...a: unknown[]) => { void a })
const deleteLecture = vi.fn(async (...a: unknown[]) => { void a })
vi.mock('@/lib/data/lectures', () => ({
  listLectures: async () => lectures, audioUsed: async () => { if (usedFails) throw new Error('no function'); return used },
  getLecture: async () => full, updateLecture: (...a: unknown[]) => updateLecture(...a), deleteLecture: (...a: unknown[]) => deleteLecture(...a),
}))
const makeFreeNote = vi.fn(async (...a: unknown[]) => { void a; return 'n1' })
const makeAiNote = vi.fn(async (...a: unknown[]) => { void a; return { ok: true, noteId: 'n2' } })
vi.mock('@/lib/lectures/lectureNotes', () => ({ makeFreeNote: (...a: unknown[]) => makeFreeNote(...a), makeAiNote: (...a: unknown[]) => makeAiNote(...a) }))
const removed: string[] = []
vi.mock('@/lib/lectures/localStore', () => ({ indexedDbStore: () => ({ sessions: async () => leftover, remove: async (id: string) => { removed.push(id) } }) }))
vi.mock('@/lib/lectures/saveRecording', () => ({ finishRecording: (...a: unknown[]) => finishRecording(...(a as [])) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
import LecturesPage from '@/app/(app)/lectures/page'
import { ProfileProvider } from '@/components/providers/ProfileProvider'
import { ConfirmProvider } from '@/components/providers/ConfirmProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'
import type { Profile } from '@/lib/types'
const profile = { id: 'u1', display_name: null, timezone: 'Africa/Accra', daily_goal_minutes: 120, focus_minutes: 25, short_break_minutes: 5, long_break_minutes: 15, long_break_every: 4, default_editor_mode: 'rich', theme: 'system', accent: 'blue', font: 'sans', auto_math: true, onboarded: true } as Profile
import { StorageCard } from '@/components/settings/StorageCard'

const MB = 1024 * 1024
beforeEach(() => {
  lectures = [{ id: 'L1', course_id: 'c1', title: 'Krebs cycle', recorded_at: '2026-10-03T09:00:00Z', duration_seconds: 3723, transcript_status: 'done', audio_bytes: 5 * MB }]
  used = 5 * MB; usedFails = false; leftover = []; removed.length = 0; finishRecording.mockClear(); push.mockClear(); updateLecture.mockClear(); deleteLecture.mockClear(); makeFreeNote.mockClear(); makeAiNote.mockClear()
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
afterEach(() => cleanup())
const open = async () => { await act(async () => { render(<ProfileProvider initial={profile}><ToastProvider><ConfirmProvider><LecturesPage /></ConfirmProvider></ToastProvider></ProfileProvider>) }) }

describe('Lectures page', () => {
  it('lists lectures with course, length and transcript status, and links to record', async () => {
    await open()
    expect(screen.getByRole('link', { name: /Krebs cycle/ }).getAttribute('href')).toBe('/lectures/L1')
    expect(screen.getByText('1:02:03')).toBeTruthy()
    expect(screen.getByText('Biology')).toBeTruthy()
    expect(screen.getByText('Accurate transcript')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Record/ }).getAttribute('href')).toBe('/lectures/record')
  })
  it('warns when storage is nearly full and blocks recording when it is full', async () => {
    used = 250 * MB
    await open()
    expect(screen.getByText(/250 MB of 300 MB/)).toBeTruthy()
    cleanup()
    used = 300 * MB
    await open()
    expect(screen.getByText(/Delete old lectures to record more/)).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Record/ })).toBeNull()
  })
  it('offers to recover a recording that wasn\'t saved, and saves it', async () => {
    leftover = [{ id: 'L9', userId: 'u1', title: 'Lost lecture', parts: [] }]
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Recover unsaved recording' })) })
    expect(finishRecording).toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith('/lectures/L9')
  })
})

describe('Lectures page: quick actions', () => {
  const menu = async () => { await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'More actions for Krebs cycle' })) }) }
  const choose = async (label: string) => { await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: label })) }) }
  it('the ⋯ button (or right-click) offers the actions for the lecture', async () => {
    await open()
    await menu()
    expect(screen.getAllByRole('menuitem').map(m => m.textContent)).toEqual(['Open', 'Rename', 'Change course', 'Make a note (free)', '✦ Make a note with AI', 'Delete'])
  })
  it('renames a lecture', async () => {
    await open(); await menu(); await choose('Rename')
    fireEvent.change(screen.getByLabelText('Lecture title'), { target: { value: 'Krebs cycle, part 2' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })
    expect(updateLecture).toHaveBeenCalledWith(expect.anything(), 'L1', { title: 'Krebs cycle, part 2' })
    expect(screen.getByRole('link', { name: /Krebs cycle, part 2/ })).toBeTruthy()
  })
  it('moves a lecture to another course, or none', async () => {
    await open(); await menu(); await choose('Change course')
    fireEvent.change(screen.getByLabelText('Course'), { target: { value: '' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })
    expect(updateLecture).toHaveBeenCalledWith(expect.anything(), 'L1', { course_id: null })
  })
  it('makes a free note, or one with AI, and opens it', async () => {
    await open(); await menu(); await choose('Make a note (free)')
    expect(makeFreeNote.mock.calls[0][1]).toEqual(full)
    expect(push).toHaveBeenCalledWith('/notes/n1')
    await menu(); await choose('✦ Make a note with AI')
    expect(push).toHaveBeenCalledWith('/notes/n2')
  })
  it('deletes a lecture and its audio after confirming', async () => {
    await open(); await menu(); await choose('Delete')
    await act(async () => { fireEvent.click(screen.getByRole('dialog').querySelector('button.btn-danger') as HTMLElement) })
    expect(deleteLecture).toHaveBeenCalledWith(expect.anything(), full)
    expect(screen.queryByRole('link', { name: /Krebs cycle/ })).toBeNull()
  })
})

describe('Lectures page: storage count unavailable', () => {
  it('still lists the lectures when storage used cannot be counted', async () => {
    usedFails = true
    await open()
    expect(screen.getByRole('link', { name: /Krebs cycle/ })).toBeTruthy()
  })
})

describe('Lectures page: transcript labels', () => {
  it('a lecture whose accurate transcript stopped still says it has its live transcript', async () => {
    lectures = [{ id: 'L2', course_id: null, title: 'Half done', recorded_at: '2026-10-03T09:00:00Z', duration_seconds: 60, transcript_status: 'failed', transcript_source: 'browser', audio_bytes: 1 }]
    await open()
    expect(screen.getByText('Live transcript')).toBeTruthy()
  })
})

describe('Lectures page: unsaved recordings', () => {
  it('only offers recordings made by the signed-in student', async () => {
    leftover = [{ id: 'L8', userId: 'someone-else', title: 'Their lecture', parts: [] }]
    await open()
    expect(screen.queryByRole('button', { name: 'Recover unsaved recording' })).toBeNull()
  })
  it('an unsaved recording can be discarded after confirming', async () => {
    leftover = [{ id: 'L9', userId: 'u1', title: 'Lost lecture', parts: [] }]
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Discard' })) })
    await act(async () => { fireEvent.click(screen.getByRole('dialog').querySelector('button.btn-danger') as HTMLElement) })
    expect(removed).toEqual(['L9'])
    expect(screen.queryByRole('button', { name: 'Recover unsaved recording' })).toBeNull()
  })
})

describe('StorageCard', () => {
  it('shows lecture audio used', async () => {
    used = 410 * MB
    await act(async () => { render(<StorageCard />) })
    expect(screen.getByText('410 MB of 300 MB lecture audio used')).toBeTruthy()
    expect(screen.getByText(/Delete old lectures to record more/)).toBeTruthy()
  })
})
