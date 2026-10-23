// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'
import type { Profile } from '@/lib/types'
import type { MyReminder } from '@/lib/reminders/mine'

vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
const createReminder = vi.fn(async (_sb: unknown, r: Omit<MyReminder, 'id'>) => ({ ...r, id: 'new' }))
const updateReminder = vi.fn(async (..._a: unknown[]) => {})
const changed = vi.fn()
vi.mock('@/lib/data/reminders', () => ({
  createReminder: (sb: unknown, r: Omit<MyReminder, 'id'>) => createReminder(sb, r), updateReminder: (...a: unknown[]) => updateReminder(...a),
  announceRemindersChanged: () => changed(),
}))
const ask = vi.fn(async () => 'granted')
let permission = 'default'
vi.mock('@/lib/focus/alert', () => ({ notificationPermission: () => permission, askNotificationPermission: () => ask() }))

import { ProfileProvider } from '@/components/providers/ProfileProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'
import { ReminderHost } from '@/components/reminders/ReminderHost'
import { requestReminder } from '@/lib/reminders/events'

const profile = { id: 'u', display_name: 'Ama', timezone: 'Africa/Accra', theme: 'light', accent: 'blue', font: 'sans', look: 'studio', onboarded: true } as Profile
const mount = async () => { await act(async () => { render(<ProfileProvider initial={profile}><ToastProvider><ReminderHost /></ToastProvider></ProfileProvider>) }) }
const click = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el) }) }
const dialog = (name = 'New reminder') => within(screen.getByRole('dialog', { name }))
const ask_ = async (p?: Parameters<typeof requestReminder>[0]) => { await act(async () => { requestReminder(p) }) }
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-23T10:20:00Z')) // a Friday morning
  permission = 'default'
  for (const f of [createReminder, updateReminder, changed, ask]) f.mockClear()
})
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('making a reminder from anywhere', () => {
  it('opens over the page when asked, starting today at the next hour, and saves what, when and how often', async () => {
    await mount()
    expect(screen.queryByRole('dialog')).toBeNull()
    await ask_()
    expect((dialog().getByLabelText('Date') as HTMLInputElement).value).toBe('2026-10-23')
    expect((dialog().getByLabelText('Time') as HTMLInputElement).value).toBe('11:00')
    fireEvent.change(dialog().getByLabelText('What'), { target: { value: 'Email my tutor' } })
    await click(dialog().getByRole('radio', { name: 'Every week' }))
    await click(dialog().getByRole('button', { name: 'Save' }))
    expect(createReminder).toHaveBeenCalledWith({}, { title: 'Email my tutor', day: '2026-10-23', at: '11:00', repeat: 'weekly', href: null, link_label: null })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('Reminder set for Today 11:00.')).toBeTruthy()
    expect(changed).toHaveBeenCalled()
    expect(ask).toHaveBeenCalledTimes(1)
  })
  it('opened from a thing, it is about that thing, which it says and which can be taken off', async () => {
    await mount()
    await ask_({ title: 'Review Cells', href: '/flashcards/d1', link_label: 'Cells' })
    expect((dialog().getByLabelText('What') as HTMLInputElement).value).toBe('Review Cells')
    expect(dialog().getByText('About Cells')).toBeTruthy()
    await click(dialog().getByRole('button', { name: 'Save' }))
    expect(createReminder).toHaveBeenCalledWith({}, expect.objectContaining({ href: '/flashcards/d1', link_label: 'Cells' }))
    await ask_({ title: 'Review Cells', href: '/flashcards/d1', link_label: 'Cells' })
    await click(dialog().getByRole('button', { name: 'Not about Cells' }))
    expect(dialog().queryByText('About Cells')).toBeNull()
    await click(dialog().getByRole('button', { name: 'Save' }))
    expect(createReminder).toHaveBeenLastCalledWith({}, expect.objectContaining({ href: null, link_label: null }))
  })
  it('can start on another day, as a task due then would', async () => {
    await mount()
    await ask_({ title: 'Essay', day: '2026-10-30' })
    expect((dialog().getByLabelText('Date') as HTMLInputElement).value).toBe('2026-10-30')
  })
  it('edits a reminder in the same dialog', async () => {
    await mount()
    await ask_({ edit: { id: 'a', title: 'Pay rent', day: '2026-11-01', at: '09:00:00', repeat: 'once' } })
    fireEvent.change(dialog('Edit reminder').getByLabelText('What'), { target: { value: 'Pay the rent' } })
    await click(dialog('Edit reminder').getByRole('button', { name: 'Save' }))
    expect(updateReminder).toHaveBeenCalledWith({}, 'a', { title: 'Pay the rent', day: '2026-11-01', at: '09:00', repeat: 'once', href: null, link_label: null })
  })
  it('will not save one without words, or a one-off in the past, also when the time passes while typing', async () => {
    await mount()
    await ask_()
    expect((dialog().getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(dialog().getByLabelText('What'), { target: { value: 'Late' } })
    vi.setSystemTime(new Date('2026-10-23T11:05:00Z'))
    await click(dialog().getByRole('button', { name: 'Save' }))
    expect(createReminder).not.toHaveBeenCalled()
    expect(dialog().getByText('That time has passed.')).toBeTruthy()
  })
  it('keeps what was typed when saving fails', async () => {
    createReminder.mockRejectedValueOnce(new Error('offline'))
    await mount()
    await ask_()
    fireEvent.change(dialog().getByLabelText('What'), { target: { value: 'Call home' } })
    await click(dialog().getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Could not save that reminder.')).toBeTruthy()
    expect((dialog().getByLabelText('What') as HTMLInputElement).value).toBe('Call home')
  })
  it('does not ask for notifications again once the browser has an answer', async () => {
    permission = 'denied'
    await mount()
    await ask_({ title: 'Call home' })
    await click(dialog().getByRole('button', { name: 'Save' }))
    expect(ask).not.toHaveBeenCalled()
  })
})
