// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act, within } from '@testing-library/react'
import type { Profile } from '@/lib/types'

let path = '/planner'
const push = vi.fn()
vi.mock('next/navigation', () => ({ usePathname: () => path, useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }) }))
let theme = 'light'
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: theme, setTheme: vi.fn() }) }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
let courseList: { id: string; name: string; color: string }[] = []
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => courseList }))
vi.mock('@/components/shell/TopBar', () => ({ TopBar: (p: { sidebarHidden?: boolean }) => <header aria-label="Today at a glance">top bar {p.sidebarHidden ? 'sidebar hidden' : 'sidebar shown'}</header> }))
vi.mock('@/components/scan/ScanDialog', () => ({
  ScanDialog: (p: { initialTarget: string; initialFiles?: File[]; onSaved?: () => void; onClose: () => void }) => (
    <div role="dialog">scan {p.initialTarget} files {p.initialFiles?.length ?? 0}<button onClick={p.onSaved}>saved</button><button onClick={p.onClose}>close</button></div>
  ),
}))

import { ProfileProvider } from '@/components/providers/ProfileProvider'
import { AppShell } from '@/components/shell/AppShell'
import { SCAN_SAVED } from '@/lib/scan/events'
import { announceCoursesChanged } from '@/lib/course/events'
import { ConfirmProvider } from '@/components/providers/ConfirmProvider'
import { setRecording } from '@/lib/lectures/recordingGuard'

const profile = { id: 'u1', display_name: null, timezone: 'Africa/Accra', daily_goal_minutes: 120, focus_minutes: 25, short_break_minutes: 5, long_break_minutes: 15, long_break_every: 4, default_editor_mode: 'rich', theme: 'system', accent: 'blue', font: 'sans', look: 'classic', auto_math: true, onboarded: true } as Profile
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

  it('has Lectures in the sidebar after Notes, and in the phone tab bar instead of Focus', () => {
    path = '/home'
    renderShell()
    const links = screen.getAllByRole('link', { name: 'Lectures' })
    expect(links).toHaveLength(2)
    expect(links[0].getAttribute('href')).toBe('/lectures')
    const sidebar = screen.getAllByRole('navigation')[0]
    const labels = [...sidebar.querySelectorAll('a')].map(a => a.textContent)
    expect(labels.indexOf('Lectures')).toBe(labels.indexOf('Notes') + 1)
    expect(screen.getAllByRole('link', { name: 'Focus' })).toHaveLength(1) // sidebar only
  })

  it('groups the sidebar: Home on its own, then Plan and Study, with Scan inside Study', () => {
    path = '/home'
    renderShell()
    const side = screen.getAllByRole('navigation')[0]
    const names = (g: HTMLElement) => [...g.querySelectorAll('a, button')].map(x => x.textContent)
    expect(side.querySelector('a')!.textContent).toBe('Home')
    expect(names(within(side).getByRole('group', { name: 'Plan' }))).toEqual(['Planner', 'Focus', 'Progress'])
    expect(names(within(side).getByRole('group', { name: 'Study' }))).toEqual(['Library', 'Notes', 'Lectures', 'Flashcards', 'Tutor', 'Upload', 'Scan'])
  })

  it('has an Upload button in the sidebar that opens the upload dialog from any page', async () => {
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
    path = '/flashcards'
    renderShell()
    expect(document.querySelector('dialog[open]')).toBeNull()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Upload' })) })
    expect(screen.getByRole('heading', { name: 'Upload material' })).toBeTruthy()
  })

  it('opens Upload when another part of the app asks for it, such as the Notes page', async () => {
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
    path = '/notes'
    renderShell()
    await act(async () => { window.dispatchEvent(new Event('studyhub:open-upload')) })
    expect(document.querySelector('dialog[open]')?.textContent).toContain('Upload material')
  })

  it('opens Scan when another part of the app asks for it', async () => {
    path = '/notes'
    renderShell()
    expect(screen.queryByRole('dialog')).toBeNull()
    await act(async () => { window.dispatchEvent(new Event('studyhub:open-scan')) })
    expect(screen.getByRole('dialog').textContent).toContain('scan note')
  })

  it('opens Scan with the photos it was asked to read, and without them the next time', async () => {
    path = '/notes'
    renderShell()
    const photo = new File(['x'], 'board.jpg', { type: 'image/jpeg' })
    await act(async () => { window.dispatchEvent(new CustomEvent('studyhub:open-scan', { detail: [photo] })) })
    expect(screen.getByRole('dialog').textContent).toContain('files 1')
    fireEvent.click(screen.getByRole('button', { name: 'close' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Scan' })[0])
    expect(screen.getByRole('dialog').textContent).toContain('files 0')
  })

  it('shows the top bar in Classic and Vivid, not in Paper, and not on a full-screen page', () => {
    path = '/home'
    const vivid = render(<ProfileProvider initial={{ ...profile, look: 'vivid' }}><AppShell><p>page</p></AppShell></ProfileProvider>)
    expect(screen.getByRole('banner', { name: 'Today at a glance' })).toBeTruthy()
    vivid.unmount()
    const classic = render(<ProfileProvider initial={profile}><AppShell><p>page</p></AppShell></ProfileProvider>)
    expect(screen.getByRole('banner', { name: 'Today at a glance' })).toBeTruthy()
    classic.unmount()
    render(<ProfileProvider initial={{ ...profile, look: 'paper' }}><AppShell><p>page</p></AppShell></ProfileProvider>)
    expect(screen.queryByRole('banner', { name: 'Today at a glance' })).toBeNull()
    cleanup()
    path = '/notes/abc'
    render(<ProfileProvider initial={{ ...profile, look: 'vivid' }}><AppShell><p>page</p></AppShell></ProfileProvider>)
    expect(screen.queryByRole('banner', { name: 'Today at a glance' })).toBeNull()
  })

  it('shows Paper as Classic in dark mode, with the top bar, and Paper again in light', () => {
    path = '/home'
    theme = 'dark'
    const dark = render(<ProfileProvider initial={{ ...profile, look: 'paper' }}><AppShell><p>page</p></AppShell></ProfileProvider>)
    expect(dark.container.querySelector('.app-root')!.getAttribute('data-look')).toBe('classic')
    expect(screen.getByRole('banner', { name: 'Today at a glance' })).toBeTruthy()
    dark.unmount(); theme = 'light'
    const light = render(<ProfileProvider initial={{ ...profile, look: 'paper' }}><AppShell><p>page</p></AppShell></ProfileProvider>)
    expect(light.container.querySelector('.app-root')!.getAttribute('data-look')).toBe('paper')
  })

  it('lists the courses in the sidebar as links to their pages, and reads them again when they change', async () => {
    path = '/home'
    courseList = [{ id: 'bio', name: 'Biology', color: '#1D9E75' }]
    await act(async () => { render(<ProfileProvider initial={profile}><AppShell><p>page</p></AppShell></ProfileProvider>) })
    const group = screen.getByRole('group', { name: 'Courses' })
    expect(within(group).getByRole('link', { name: 'Biology' }).getAttribute('href')).toBe('/courses/bio')
    courseList = [{ id: 'bio', name: 'Biology', color: '#1D9E75' }, { id: 'chem', name: 'Chemistry', color: '#BA7517' }]
    await act(async () => { announceCoursesChanged() })
    expect(within(screen.getByRole('group', { name: 'Courses' })).getByRole('link', { name: 'Chemistry' }).getAttribute('href')).toBe('/courses/chem')
  })
  it('marks the course being viewed', async () => {
    path = '/courses/bio'
    courseList = [{ id: 'bio', name: 'Biology', color: '#1D9E75' }]
    await act(async () => { render(<ProfileProvider initial={profile}><AppShell><p>page</p></AppShell></ProfileProvider>) })
    expect(within(screen.getByRole('group', { name: 'Courses' })).getByRole('link', { name: 'Biology' }).getAttribute('aria-current')).toBe('page')
  })
  it('marks Courses itself when the courses page is open', async () => {
    path = '/courses'
    courseList = [{ id: 'bio', name: 'Biology', color: '#1D9E75' }]
    await act(async () => { render(<ProfileProvider initial={profile}><AppShell><p>page</p></AppShell></ProfileProvider>) })
    const group = screen.getByRole('group', { name: 'Courses' })
    expect(within(group).getByRole('link', { name: 'Courses' }).getAttribute('aria-current')).toBe('page')
  })
  it('has no Courses group before there is a course', async () => {
    path = '/home'; courseList = []
    await act(async () => { render(<ProfileProvider initial={profile}><AppShell><p>page</p></AppShell></ProfileProvider>) })
    expect(screen.queryByRole('group', { name: 'Courses' })).toBeNull()
  })

  it('marks the shell when the top bar shows the page name, so the page does not say it twice', () => {
    path = '/home'
    const withBar = render(<ProfileProvider initial={profile}><AppShell><p>page</p></AppShell></ProfileProvider>)
    expect(withBar.container.querySelector('.app-root')!.hasAttribute('data-topbar')).toBe(true)
    withBar.unmount()
    const without = render(<ProfileProvider initial={{ ...profile, look: 'paper' }}><AppShell><p>page</p></AppShell></ProfileProvider>)
    expect(without.container.querySelector('.app-root')!.hasAttribute('data-topbar')).toBe(false)
  })

  it('sizes the content by the student\'s width choice, and the planner always uses the whole screen', () => {
    const main = (path_: string, width?: string) => {
      path = path_
      const r = render(<ProfileProvider initial={{ ...profile, ...(width ? { content_width: width } : {}) } as Profile}><AppShell><p>page</p></AppShell></ProfileProvider>)
      const cls = r.container.querySelector('main')!.className
      r.unmount()
      return cls
    }
    expect(main('/home', 'focused')).toContain('max-w-5xl')
    expect(main('/home', 'wide')).toContain('max-w-[1400px]')
    expect(main('/home', 'full')).toContain('max-w-none')
    expect(main('/home')).toContain('max-w-[1400px]') // an old profile without a choice is wide
    expect(main('/planner', 'focused')).toContain('max-w-none')
  })

  it('Upload and Scan are solid and darker than the sidebar, with no dashed outline', () => {
    path = '/home'
    const { container } = render(<ProfileProvider initial={profile}><AppShell><p>page</p></AppShell></ProfileProvider>)
    const side = container.querySelector('.app-sidebar') as HTMLElement
    for (const name of ['Upload', 'Scan']) {
      const b = within(side).getByRole('button', { name })
      expect(b.className, name).not.toContain('dashed')
      expect(b.className, name).toContain('bg-black/')
    }
  })

  it('marks the sidebar so the Vivid styles reach it and nothing else, and tells the top bar when the sidebar is hidden', () => {
    path = '/home'
    const shown = render(<ProfileProvider initial={{ ...profile, look: 'vivid' }}><AppShell><p>page</p></AppShell></ProfileProvider>)
    expect(shown.container.querySelector('aside.app-sidebar')).not.toBeNull()
    expect(screen.getByRole('banner', { name: 'Today at a glance' }).textContent).toContain('sidebar shown')
    shown.unmount()
    render(<ProfileProvider initial={{ ...profile, look: 'vivid' }}><AppShell initialCollapsed><p>page</p></AppShell></ProfileProvider>)
    expect(screen.getByRole('banner', { name: 'Today at a glance' }).textContent).toContain('sidebar hidden')
  })

  it('has the name and avatar of the student at the bottom of the sidebar, linking to the profile', () => {
    path = '/home'
    render(<ProfileProvider initial={{ ...profile, display_name: 'Ama Mensah', avatar_color: '#BE185D' }}><AppShell><p>page</p></AppShell></ProfileProvider>)
    const link = screen.getByRole('link', { name: 'Ama Mensah' })
    expect(link.getAttribute('href')).toBe('/profile')
    expect(link.querySelector('[data-testid="avatar"]')!.textContent).toBe('AM')
  })
  it('says Your profile when the student has no name yet', () => {
    path = '/home'
    renderShell()
    expect(screen.getByRole('link', { name: 'Your profile' }).getAttribute('href')).toBe('/profile')
  })
  it('marks the profile link as the current page on the profile page', () => {
    path = '/profile'
    renderShell()
    expect(screen.getByRole('link', { name: 'Your profile' }).getAttribute('aria-current')).toBe('page')
  })
  it('has Library first in the Study group, linking to /library', () => {
    path = '/home'
    renderShell()
    expect(screen.getAllByRole('link', { name: 'Library' })[0].getAttribute('href')).toBe('/library')
  })

  it('has Tutor in the sidebar and the phone tab bar', () => {
    path = '/home'
    renderShell()
    const links = screen.getAllByRole('link', { name: 'Tutor' })
    expect(links).toHaveLength(2)
    expect(links[0].getAttribute('href')).toBe('/tutor')
  })

  it('marks the shell with the student\'s look, and shows Classic for an old profile without one', () => {
    path = '/home'
    const { container, unmount } = render(<ProfileProvider initial={{ ...profile, look: 'paper' }}><AppShell><p>page</p></AppShell></ProfileProvider>)
    expect(container.querySelector('.app-root')!.getAttribute('data-look')).toBe('paper')
    unmount()
    const old = { ...profile } as Record<string, unknown>
    delete old.look
    const again = render(<ProfileProvider initial={old as unknown as Profile}><AppShell><p>page</p></AppShell></ProfileProvider>)
    expect(again.container.querySelector('.app-root')!.getAttribute('data-look')).toBe('classic')
  })

  it('while a lecture is recording, leaving through the sidebar asks first', async () => {
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
    path = '/lectures/record'
    setRecording(true)
    render(<ProfileProvider initial={profile}><ConfirmProvider><AppShell><p>page</p></AppShell></ConfirmProvider></ProfileProvider>)
    fireEvent.click(screen.getAllByRole('link', { name: 'Planner' })[0])
    expect(screen.getByText('Stop recording?')).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Leave' })) })
    expect(push).toHaveBeenCalledWith('/planner')
    setRecording(false)
  })
})
