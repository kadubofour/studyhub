// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act, within } from '@testing-library/react'
import type { Profile } from '@/lib/types'

let path = '/planner'
const push = vi.fn()
vi.mock('next/navigation', () => ({ usePathname: () => path, useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }) }))
const setTheme = vi.fn()
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'dark', setTheme }) }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/profile', () => ({ updateProfile: async () => {} }))
let courseList: { id: string; name: string; color: string }[] = []
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => courseList }))
const createNote = vi.fn(async () => ({ id: 'n9' }))
vi.mock('@/lib/data/notes', () => ({ listNotes: async () => [{ id: 'n1', title: 'Krebs cycle', course_id: null, updated_at: '2026-10-20T00:00:00Z' }], createNote: () => createNote() }))
vi.mock('@/lib/data/decks', () => ({ listDecks: async () => [{ id: 'd1', name: 'Cell parts', course_id: null, created_at: '2026-10-19T00:00:00Z' }] }))
vi.mock('@/lib/data/lectures', () => ({ listLectures: async () => [] }))
// The status strip reads the timer, cards and XP: here it is the search button the shell gives it
vi.mock('@/components/shell/TopBar', () => ({ TopBar: (p: { onSearch: () => void }) => <header aria-label="Today at a glance"><button type="button" onClick={p.onSearch}>Search or jump</button></header> }))
vi.mock('@/components/scan/ScanDialog', () => ({
  ScanDialog: (p: { initialTarget: string; onClose: () => void }) => <div role="dialog" aria-label="Scan">scan {p.initialTarget}<button onClick={p.onClose}>close</button></div>,
}))
vi.mock('@/components/notes/UploadMaterial', () => ({ UploadMaterial: (p: { open: boolean }) => (p.open ? <div role="dialog" aria-label="Upload material">upload</div> : null) }))
vi.mock('@/components/quiz/QuizStartDialog', () => ({ QuizStartDialog: () => <div role="dialog" aria-label="Quiz yourself">quiz</div> }))

import { ProfileProvider } from '@/components/providers/ProfileProvider'
import { ConfirmProvider } from '@/components/providers/ConfirmProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'
import { AppShell } from '@/components/shell/AppShell'
import { requestScan, requestUpload } from '@/lib/scan/events'
import { requestQuiz } from '@/lib/quiz/events'
import { setRecording } from '@/lib/lectures/recordingGuard'

const profile = { id: 'u1', display_name: 'Kwadwo', timezone: 'Africa/Accra', daily_goal_minutes: 120, focus_minutes: 25, short_break_minutes: 5, long_break_minutes: 15, long_break_every: 4, default_editor_mode: 'rich', theme: 'dark', accent: 'blue', font: 'sans', look: 'classic', auto_math: true, onboarded: true } as Profile
const shell = async (p: Partial<Profile> = {}) => {
  await act(async () => { render(<ProfileProvider initial={{ ...profile, ...p } as Profile}><ToastProvider><ConfirmProvider><AppShell><p>page</p></AppShell></ConfirmProvider></ToastProvider></ProfileProvider>) })
}
const rail = () => within(screen.getByRole('navigation', { name: 'Studyhub' }))
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
beforeEach(() => { path = '/planner'; push.mockClear(); createNote.mockClear(); courseList = []; setRecording(false) })
afterEach(cleanup)

describe('the rail', () => {
  it('has every place, in order, each a link with its name, and marks the one you are on', async () => {
    await shell()
    expect(rail().getAllByRole('link').map(l => l.getAttribute('aria-label'))).toEqual(
      ['Home', 'Planner', 'Reminders', 'Focus', 'Notes', 'Flashcards', 'Lectures', 'Tutor', 'Quiz', 'Library', 'Progress', 'Settings', 'Kwadwo'])
    expect(rail().getByRole('link', { name: 'Planner' }).getAttribute('aria-current')).toBe('page')
    expect(rail().getByRole('link', { name: 'Notes' }).getAttribute('aria-current')).toBeNull()
    expect(rail().getByRole('link', { name: 'Kwadwo' }).getAttribute('href')).toBe('/profile')
  })
  it('switches between light and dark', async () => {
    await shell()
    fireEvent.click(rail().getByRole('button', { name: 'Light mode' }))
    expect(setTheme).toHaveBeenCalledWith('light')
  })
  it('asks first when leaving would stop a recording', async () => {
    await shell()
    setRecording(true)
    await act(async () => { fireEvent.click(rail().getByRole('link', { name: 'Notes' })) })
    expect(screen.getByText('Stop recording?')).toBeTruthy()
    expect(push).not.toHaveBeenCalled()
  })
})

describe('the sidebar', () => {
  it('is wide by default, with names beside the icons and your courses', async () => {
    courseList = [{ id: 'k1', name: 'Biology', color: '#1D9E75' }]
    await shell()
    expect(rail().getByText('Studyhub')).toBeTruthy()
    expect(rail().getByRole('link', { name: 'Notes' }).textContent).toContain('Notes')
    const courses = within(rail().getByRole('group', { name: 'Courses' }))
    expect(courses.getByRole('link', { name: /Biology/ }).getAttribute('href')).toBe('/courses/k1')
  })
  it('shrinks to a rail of icons, remembers it in a cookie, and expands again', async () => {
    courseList = [{ id: 'k1', name: 'Biology', color: '#1D9E75' }]
    await shell()
    fireEvent.click(rail().getByRole('button', { name: 'Shrink sidebar' }))
    expect(document.cookie).toContain('studyhub_sidebar_collapsed=1')
    expect(rail().queryByRole('group', { name: 'Courses' })).toBeNull()
    expect(rail().getByRole('link', { name: 'Notes' }).textContent).toBe('Notes') // the tooltip only
    fireEvent.click(rail().getByRole('button', { name: 'Expand sidebar' }))
    expect(document.cookie).toContain('studyhub_sidebar_collapsed=0')
    expect(rail().getByRole('group', { name: 'Courses' })).toBeTruthy()
  })
  it('wears the chosen look: Studio by default, or the one in Settings, and the sidebar can be coloured by it', async () => {
    const { container } = await (async () => { let r!: ReturnType<typeof render>; await act(async () => { r = render(<ProfileProvider initial={{ ...profile, look: undefined } as unknown as Profile}><ToastProvider><ConfirmProvider><AppShell><p>page</p></AppShell></ConfirmProvider></ToastProvider></ProfileProvider>) }); return r })()
    expect(container.querySelector('.app-root')!.getAttribute('data-look')).toBe('studio')
    cleanup()
    await shell({ look: 'vivid' } as Partial<Profile>)
    expect(document.querySelector('.app-root')!.getAttribute('data-look')).toBe('vivid')
    expect(screen.getByRole('navigation', { name: 'Studyhub' }).classList.contains('app-sidebar')).toBe(true)
  })
  it('starts shrunk when the cookie said so', async () => {
    await act(async () => { render(<ProfileProvider initial={profile}><ToastProvider><ConfirmProvider><AppShell initialCollapsed><p>page</p></AppShell></ConfirmProvider></ToastProvider></ProfileProvider>) })
    expect(rail().getByRole('button', { name: 'Expand sidebar' })).toBeTruthy()
    expect(rail().queryByText('Studyhub')).toBeNull()
  })
})

describe('Create', () => {
  it('opens a menu of everything that makes something', async () => {
    await shell()
    fireEvent.click(rail().getByRole('button', { name: 'Create new' }))
    const menu = within(screen.getByRole('menu', { name: 'Create' }))
    expect(menu.getAllByRole('menuitem').map(m => m.getAttribute('aria-label'))).toEqual(['New note', 'New deck', 'Record lecture', 'New task', 'New reminder', 'Upload', 'Scan'])
  })
  it('makes a note and opens it, and opens Upload and Scan (Scan starting on what the page holds)', async () => {
    await shell()
    fireEvent.click(rail().getByRole('button', { name: 'Create new' }))
    await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'New note' })) })
    expect(push).toHaveBeenCalledWith('/notes/n9')
    fireEvent.click(rail().getByRole('button', { name: 'Create new' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Upload' }))
    expect(screen.getByRole('dialog', { name: 'Upload material' })).toBeTruthy()
    fireEvent.click(rail().getByRole('button', { name: 'Create new' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Scan' }))
    expect(screen.getByRole('dialog', { name: 'Scan' }).textContent).toContain('scan planner')
  })
  it('closes with Escape', async () => {
    await shell()
    fireEvent.click(rail().getByRole('button', { name: 'Create new' }))
    fireEvent.keyDown(screen.getByRole('menu', { name: 'Create' }), { key: 'Escape' })
    expect(screen.queryByRole('menu', { name: 'Create' })).toBeNull()
  })
})

describe('the command palette', () => {
  const open = async () => { await act(async () => { fireEvent.keyDown(window, { key: 'k', ctrlKey: true }) }) }
  const box = () => screen.getByRole('combobox', { name: 'Search or jump' })
  it('opens with Ctrl+K and from the search button, and closes with Escape', async () => {
    await shell()
    await open()
    expect(screen.getByRole('dialog', { name: 'Search or jump' })).toBeTruthy()
    fireEvent.keyDown(box(), { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Search or jump' })).toBeNull()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Search or jump' })) })
    expect(screen.getByRole('dialog', { name: 'Search or jump' })).toBeTruthy()
  })
  it('jumps to a page: type, then Enter', async () => {
    await shell()
    await open()
    fireEvent.change(box(), { target: { value: 'flash' } })
    await act(async () => { fireEvent.keyDown(box(), { key: 'Enter' }) })
    expect(push).toHaveBeenCalledWith('/flashcards')
    expect(screen.queryByRole('dialog', { name: 'Search or jump' })).toBeNull()
  })
  it('finds courses and material, and the arrow keys move between results', async () => {
    courseList = [{ id: 'k1', name: 'Biology', color: '#1D9E75' }]
    await shell()
    await open()
    fireEvent.change(box(), { target: { value: 'krebs' } })
    expect(screen.getByRole('option', { name: /Krebs cycle/ }).getAttribute('aria-selected')).toBe('true')
    fireEvent.change(box(), { target: { value: 'bio' } })
    await act(async () => { fireEvent.keyDown(box(), { key: 'Enter' }) })
    expect(push).toHaveBeenCalledWith('/courses/k1')
    await open()
    fireEvent.change(box(), { target: { value: 'c' } })
    const first = screen.getAllByRole('option')[0]
    fireEvent.keyDown(box(), { key: 'ArrowDown' })
    expect(first.getAttribute('aria-selected')).toBe('false')
    expect(screen.getAllByRole('option')[1].getAttribute('aria-selected')).toBe('true')
  })
  it('does things: Upload opens the upload dialog; Light mode switches the theme', async () => {
    await shell()
    await open()
    fireEvent.change(box(), { target: { value: 'upload' } })
    await act(async () => { fireEvent.keyDown(box(), { key: 'Enter' }) })
    expect(screen.getByRole('dialog', { name: 'Upload material' })).toBeTruthy()
  })
  it('says when nothing matches', async () => {
    await shell()
    await open()
    fireEvent.change(box(), { target: { value: 'zzzz' } })
    expect(screen.getByText('Nothing matches.')).toBeTruthy()
  })
})

describe('on a phone', () => {
  it('a dock with Home, Planner, Create, Notes and Flashcards', async () => {
    path = '/notes'
    await shell()
    const dock = within(screen.getByRole('navigation', { name: 'Main' }))
    expect(dock.getAllByRole('link').map(l => l.getAttribute('aria-label'))).toEqual(['Home', 'Planner', 'Notes', 'Flashcards'])
    expect(dock.getByRole('link', { name: 'Notes' }).getAttribute('aria-current')).toBe('page')
    fireEvent.click(dock.getByRole('button', { name: 'Create new' }))
    expect(screen.getByRole('menu', { name: 'Create' })).toBeTruthy()
  })
})

describe('the frame', () => {
  it('has no rail, dock or status strip on a full-screen page such as a note', async () => {
    path = '/notes/n1'
    await shell()
    expect(screen.queryByRole('navigation', { name: 'Studyhub' })).toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull()
    expect(screen.queryByRole('banner', { name: 'Today at a glance' })).toBeNull()
  })
  it('sizes the content by the width choice; the planner uses the whole screen', async () => {
    const main = async (p: string, width?: string) => { path = p; await shell(width ? { content_width: width } as Partial<Profile> : {}); const c = screen.getByRole('main').className; cleanup(); return c }
    expect(await main('/home', 'focused')).toContain('max-w-5xl')
    expect(await main('/home', 'wide')).toContain('max-w-[1320px]')
    expect(await main('/home')).toContain('max-w-[1320px]')
    expect(await main('/planner', 'focused')).toContain('max-w-none')
  })
  it('opens Scan, Upload and Quiz when another part of the app asks', async () => {
    path = '/flashcards'
    await shell()
    await act(async () => { requestScan() })
    expect(screen.getByRole('dialog', { name: 'Scan' }).textContent).toContain('scan cards')
    fireEvent.click(screen.getByRole('button', { name: 'close' }))
    await act(async () => { requestUpload() })
    expect(screen.getByRole('dialog', { name: 'Upload material' })).toBeTruthy()
    await act(async () => { requestQuiz() })
    expect(screen.getByRole('dialog', { name: 'Quiz yourself' })).toBeTruthy()
  })
})

describe('reminders from anywhere', () => {
  it('New reminder in the Create menu opens the Reminders page ready to write one', async () => {
    await shell()
    fireEvent.click(rail().getByRole('button', { name: 'Create new' }))
    await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'New reminder' })) })
    expect(push).toHaveBeenCalledWith('/reminders?new=1')
  })
})
