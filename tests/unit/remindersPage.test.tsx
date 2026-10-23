// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'
import type { Profile } from '@/lib/types'
import type { MyReminder } from '@/lib/reminders/mine'

let search = ''
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(search), useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
let rows: MyReminder[] = []
const createReminder = vi.fn(async (_sb: unknown, r: Omit<MyReminder, 'id'>) => { const made = { ...r, id: `new${rows.length}` }; rows = [...rows, made]; return made })
const updateReminder = vi.fn(async (_sb: unknown, id: string, patch: Partial<MyReminder>) => { rows = rows.map(r => (r.id === id ? { ...r, ...patch } : r)) })
const deleteReminder = vi.fn(async (_sb: unknown, id: string) => { rows = rows.filter(r => r.id !== id) })
const deleteReminders = vi.fn(async (_sb: unknown, ids: string[]) => { rows = rows.filter(r => !ids.includes(r.id)) })
const changed = vi.fn()
vi.mock('@/lib/data/reminders', () => ({
  listReminders: async () => rows,
  createReminder: (sb: unknown, r: Omit<MyReminder, 'id'>) => createReminder(sb, r), updateReminder: (sb: unknown, id: string, p: Partial<MyReminder>) => updateReminder(sb, id, p),
  deleteReminder: (sb: unknown, id: string) => deleteReminder(sb, id), deleteReminders: (sb: unknown, ids: string[]) => deleteReminders(sb, ids),
  announceRemindersChanged: () => changed(), REMINDERS_CHANGED: 'studyhub:reminders-changed',
}))
const ask = vi.fn(async () => 'granted')
let permission = 'default'
vi.mock('@/lib/focus/alert', () => ({ notificationPermission: () => permission, askNotificationPermission: () => ask() }))

import { ProfileProvider } from '@/components/providers/ProfileProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'
import RemindersPage from '@/app/(app)/reminders/page'
import { DEFAULT_REMINDERS, reminderPrefs } from '@/lib/reminders/prefs'

const profile = { id: 'u', display_name: 'Ama', timezone: 'Africa/Accra', daily_goal_minutes: 120, theme: 'light', accent: 'blue', font: 'sans', look: 'studio', onboarded: true } as Profile
const tree = () => <ProfileProvider initial={profile}><ToastProvider><RemindersPage /></ToastProvider></ProfileProvider>
const open = async () => { await act(async () => { render(<ProfileProvider initial={profile}><ToastProvider><RemindersPage /></ToastProvider></ProfileProvider>) }) }
const click = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el) }) }
const titles = (list: string) => within(screen.getByRole('list', { name: list })).getAllByRole('listitem').map(li => li.querySelector('[data-title]')!.textContent)
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-23T10:20:00Z')) // a Friday morning
  search = ''; permission = 'default'; reminderPrefs.set(DEFAULT_REMINDERS)
  rows = [
    { id: 'a', title: 'Pay rent', day: '2026-11-01', at: '09:00:00', repeat: 'once' },
    { id: 'b', title: 'Vitamins', day: '2026-10-01', at: '08:00:00', repeat: 'daily' },
    { id: 'c', title: 'Old one', day: '2026-10-20', at: '09:00:00', repeat: 'once' },
  ]
  for (const f of [createReminder, updateReminder, deleteReminder, deleteReminders, changed, ask]) f.mockClear()
})
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('the Reminders page', () => {
  it('lists what is coming, soonest first, saying when and how it repeats, and what has passed', async () => {
    await open()
    expect(screen.getByRole('heading', { level: 1, name: 'Reminders' })).toBeTruthy()
    expect(titles('Upcoming')).toEqual(['Vitamins', 'Pay rent'])
    expect(within(screen.getByRole('list', { name: 'Upcoming' })).getAllByRole('listitem')[0].textContent).toContain('Tomorrow 08:00 · Every day')
    expect(titles('Past')).toEqual(['Old one'])
  })
  it('says how reminders arrive, and whether the automatic ones are on, with a way to them', async () => {
    await open()
    expect(screen.getByText(/show while Studyhub is open/)).toBeTruthy()
    const auto = within(screen.getByRole('region', { name: 'Automatic reminders' }))
    expect(auto.getByText(/Off/)).toBeTruthy()
    expect(auto.getByRole('link', { name: 'Set them up' }).getAttribute('href')).toBe('/settings?section=reminders')
  })
  it('makes a reminder: what, when and how often, starting today at the next hour, and asks once for notifications', async () => {
    await open()
    await click(screen.getByRole('button', { name: 'New reminder' }))
    const dialog = within(screen.getByRole('dialog', { name: 'New reminder' }))
    expect((dialog.getByLabelText('Date') as HTMLInputElement).value).toBe('2026-10-23')
    expect((dialog.getByLabelText('Time') as HTMLInputElement).value).toBe('11:00')
    fireEvent.change(dialog.getByLabelText('What'), { target: { value: 'Email my tutor' } })
    await click(dialog.getByRole('radio', { name: 'Every week' }))
    await click(dialog.getByRole('button', { name: 'Save' }))
    expect(createReminder).toHaveBeenCalledWith({}, { title: 'Email my tutor', day: '2026-10-23', at: '11:00', repeat: 'weekly' })
    expect(ask).toHaveBeenCalledTimes(1)
    expect(changed).toHaveBeenCalled()
    expect(titles('Upcoming')[0]).toBe('Email my tutor')
  })
  it('will not save one without words, or a one-off already in the past', async () => {
    await open()
    await click(screen.getByRole('button', { name: 'New reminder' }))
    const dialog = within(screen.getByRole('dialog', { name: 'New reminder' }))
    expect((dialog.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(dialog.getByLabelText('What'), { target: { value: 'Too late' } })
    fireEvent.change(dialog.getByLabelText('Time'), { target: { value: '09:00' } })
    expect(dialog.getByText('That time has passed.')).toBeTruthy()
    expect((dialog.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('edits a reminder in the same dialog', async () => {
    await open()
    await click(screen.getByRole('button', { name: 'Edit Pay rent' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Edit reminder' }))
    expect((dialog.getByLabelText('What') as HTMLInputElement).value).toBe('Pay rent')
    fireEvent.change(dialog.getByLabelText('What'), { target: { value: 'Pay the rent' } })
    await click(dialog.getByRole('button', { name: 'Save' }))
    expect(updateReminder).toHaveBeenCalledWith({}, 'a', { title: 'Pay the rent', day: '2026-11-01', at: '09:00', repeat: 'once' })
    expect(titles('Upcoming')).toContain('Pay the rent')
  })
  it('deletes one, and clears everything past at once', async () => {
    await open()
    await click(screen.getByRole('button', { name: 'Delete Vitamins' }))
    expect(deleteReminder).toHaveBeenCalledWith({}, 'b')
    await click(screen.getByRole('button', { name: 'Clear past' }))
    expect(deleteReminders).toHaveBeenCalledWith({}, ['c'])
    expect(screen.queryByRole('list', { name: 'Past' })).toBeNull()
  })
  it('opens New reminder from the address, as the Create menu does, and takes it out of the address once closed', async () => {
    search = 'new=1'
    const replace = vi.spyOn(window.history, 'replaceState')
    await open()
    expect(screen.getByRole('dialog', { name: 'New reminder' })).toBeTruthy()
    await click(within(screen.getByRole('dialog', { name: 'New reminder' })).getByRole('button', { name: 'Cancel' }))
    expect(String(replace.mock.calls.at(-1)![2])).not.toContain('new=1') // a reload does not open it again
    replace.mockRestore()
  })
  it('opens New reminder again when the Create menu asks while the page is already open', async () => {
    let view!: ReturnType<typeof render>
    await act(async () => { view = render(tree()) })
    search = 'new=1'
    await act(async () => { view.rerender(tree()) })
    expect(screen.getByRole('dialog', { name: 'New reminder' })).toBeTruthy()
    await click(within(screen.getByRole('dialog', { name: 'New reminder' })).getByRole('button', { name: 'Cancel' }))
    search = ''
    await act(async () => { view.rerender(tree()) })
    search = 'new=1'
    await act(async () => { view.rerender(tree()) })
    expect(screen.getByRole('dialog', { name: 'New reminder' })).toBeTruthy() // and every time after
  })
  it('keeps itself up to date: a reminder whose time comes moves to Past without a reload', async () => {
    rows = [{ id: 's', title: 'Soon', day: '2026-10-23', at: '10:30:00', repeat: 'once' }]
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] }); vi.setSystemTime(new Date('2026-10-23T10:20:00Z'))
    await open()
    expect(titles('Upcoming')).toEqual(['Soon'])
    await act(async () => { vi.setSystemTime(new Date('2026-10-23T10:31:00Z')); vi.advanceTimersByTime(60_000) })
    expect(titles('Past')).toEqual(['Soon'])
  })
  it('keeps what was typed when saving fails', async () => {
    createReminder.mockRejectedValueOnce(new Error('offline'))
    await open()
    await click(screen.getByRole('button', { name: 'New reminder' }))
    fireEvent.change(within(screen.getByRole('dialog', { name: 'New reminder' })).getByLabelText('What'), { target: { value: 'Call home' } })
    await click(within(screen.getByRole('dialog', { name: 'New reminder' })).getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Could not save that reminder.')).toBeTruthy()
    expect((within(screen.getByRole('dialog', { name: 'New reminder' })).getByLabelText('What') as HTMLInputElement).value).toBe('Call home')
  })
  it('will not save a one-off whose time passed while the dialog was open', async () => {
    await open()
    await click(screen.getByRole('button', { name: 'New reminder' }))
    const dialog = within(screen.getByRole('dialog', { name: 'New reminder' }))
    fireEvent.change(dialog.getByLabelText('What'), { target: { value: 'Late' } })
    vi.setSystemTime(new Date('2026-10-23T11:05:00Z')) // the default 11:00 is now behind
    await click(dialog.getByRole('button', { name: 'Save' }))
    expect(createReminder).not.toHaveBeenCalled()
    expect(dialog.getByText('That time has passed.')).toBeTruthy()
  })
  it('invites a first reminder when there are none', async () => {
    rows = []
    await open()
    expect(screen.getByRole('heading', { name: 'No reminders yet' })).toBeTruthy()
  })
  it('does not ask for notifications again once the browser has an answer', async () => {
    permission = 'denied'
    await open()
    await click(screen.getByRole('button', { name: 'New reminder' }))
    const dialog = within(screen.getByRole('dialog', { name: 'New reminder' }))
    fireEvent.change(dialog.getByLabelText('What'), { target: { value: 'Call home' } })
    await click(dialog.getByRole('button', { name: 'Save' }))
    expect(ask).not.toHaveBeenCalled()
  })
})
