// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'
import type { MyReminder } from '@/lib/reminders/mine'

vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
let rows: MyReminder[] = []
let reads = 0
const deleteReminder = vi.fn(async (_sb: unknown, id: string) => { rows = rows.filter(r => r.id !== id) })
const deleteReminders = vi.fn(async (_sb: unknown, ids: string[]) => { rows = rows.filter(r => !ids.includes(r.id)) })
vi.mock('@/lib/data/reminders', () => ({
  listReminders: async () => { reads++; return rows },
  deleteReminder: (sb: unknown, id: string) => deleteReminder(sb, id), deleteReminders: (sb: unknown, ids: string[]) => deleteReminders(sb, ids),
  announceRemindersChanged: () => window.dispatchEvent(new Event('studyhub:reminders-changed')), REMINDERS_CHANGED: 'studyhub:reminders-changed',
}))
import { ToastProvider } from '@/components/providers/ToastProvider'
import { RemindersList } from '@/components/reminders/RemindersList'
import { OPEN_REMINDER } from '@/lib/reminders/events'

const TZ = 'Africa/Accra'
const open = async () => { await act(async () => { render(<ToastProvider><RemindersList tz={TZ} /></ToastProvider>) }) }
const click = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el) }) }
const titles = (list: string) => within(screen.getByRole('list', { name: list })).getAllByRole('listitem').map(li => li.querySelector('[data-title]')!.textContent)
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] }); vi.setSystemTime(new Date('2026-10-23T10:20:00Z')) // a Friday morning
  reads = 0
  rows = [
    { id: 'a', title: 'Pay rent', day: '2026-11-01', at: '09:00:00', repeat: 'once' },
    { id: 'b', title: 'Review Cells', day: '2026-10-01', at: '08:00:00', repeat: 'daily', href: '/flashcards/d1', link_label: 'Cells' },
    { id: 'c', title: 'Old one', day: '2026-10-20', at: '09:00:00', repeat: 'once' },
  ]
  deleteReminder.mockClear(); deleteReminders.mockClear()
})
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('the reminders list', () => {
  it('lists what is coming, soonest first, saying when, how it repeats and what it is about, and what has passed', async () => {
    await open()
    expect(titles('Upcoming')).toEqual(['Review Cells', 'Pay rent'])
    const first = within(screen.getByRole('list', { name: 'Upcoming' })).getAllByRole('listitem')[0]
    expect(first.textContent).toContain('Tomorrow 08:00 · Every day')
    expect(within(first).getByRole('link', { name: 'Cells' }).getAttribute('href')).toBe('/flashcards/d1')
    expect(titles('Past')).toEqual(['Old one'])
  })
  it('asks for a new one, or to edit one, in the reminder dialog', async () => {
    const heard = vi.fn()
    window.addEventListener(OPEN_REMINDER, heard as EventListener)
    await open()
    await click(screen.getByRole('button', { name: 'New reminder' }))
    await click(screen.getByRole('button', { name: 'Edit Pay rent' }))
    const details = heard.mock.calls.map(c => (c[0] as CustomEvent).detail)
    expect(details[0]).toBeFalsy() // a blank one
    expect(details[1].edit.id).toBe('a')
    window.removeEventListener(OPEN_REMINDER, heard as EventListener)
  })
  it('deletes one, and clears everything past at once', async () => {
    await open()
    await click(screen.getByRole('button', { name: 'Delete Review Cells' }))
    expect(deleteReminder).toHaveBeenCalledWith({}, 'b')
    await click(screen.getByRole('button', { name: 'Clear past' }))
    expect(deleteReminders).toHaveBeenCalledWith({}, ['c'])
    expect(screen.queryByRole('list', { name: 'Past' })).toBeNull()
  })
  it('reads them again when one is made or changed anywhere', async () => {
    await open()
    const before = reads
    rows = [...rows, { id: 'd', title: 'New one', day: '2026-10-23', at: '12:00:00', repeat: 'once' }]
    await act(async () => { window.dispatchEvent(new Event('studyhub:reminders-changed')) })
    expect(reads).toBeGreaterThan(before)
    expect(titles('Upcoming')[0]).toBe('New one')
  })
  it('keeps time: a reminder whose time comes moves to Past without a reload', async () => {
    rows = [{ id: 's', title: 'Soon', day: '2026-10-23', at: '10:30:00', repeat: 'once' }]
    await open()
    expect(titles('Upcoming')).toEqual(['Soon'])
    await act(async () => { vi.setSystemTime(new Date('2026-10-23T10:31:00Z')); vi.advanceTimersByTime(60_000) })
    expect(titles('Past')).toEqual(['Soon'])
  })
  it('invites a first reminder when there are none, and says how they arrive', async () => {
    rows = []
    await open()
    expect(screen.getByText(/No reminders yet/)).toBeTruthy()
    expect(screen.getByText(/show while Studyhub is open/)).toBeTruthy()
  })
})
