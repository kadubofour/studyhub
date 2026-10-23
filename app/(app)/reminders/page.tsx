'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Bell, BellRing, Pencil, Plus, Trash2 } from 'lucide-react'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ReminderDialog, freshReminder } from '@/components/reminders/ReminderDialog'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { announceRemindersChanged, createReminder, deleteReminder, deleteReminders, listReminders, updateReminder, type ReminderInput } from '@/lib/data/reminders'
import { askNotificationPermission, notificationPermission } from '@/lib/focus/alert'
import { describeRepeat, nextOccurrence, whenLabel, type MyReminder } from '@/lib/reminders/mine'
import { useReminderPrefs } from '@/lib/reminders/prefs'

// The student's own reminders: what is coming, soonest first, and the one-offs that have passed (see docs/superpowers/specs/2026-10-30-my-reminders-design.md)
export default function RemindersPage() {
  const { profile } = useProfile()
  const toast = useToast()
  const tz = profile.timezone
  const prefs = useReminderPrefs()
  const fromAddress = useSearchParams().get('new') === '1'
  const [rows, setRows] = useState<MyReminder[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [editing, setEditing] = useState<MyReminder | null>(null)
  const [start, setStart] = useState<ReminderInput | null>(() => (fromAddress ? freshReminder(new Date(), tz) : null))

  const load = useCallback(async () => {
    try { setRows(await listReminders(supabase())); setFailed(false) } catch { setFailed(true) }
  }, [])
  useEffect(() => {
    let live = true
    listReminders(supabase()).then(r => { if (live) setRows(r) }).catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [])

  const now = new Date()
  const withNext = (rows ?? []).map(r => ({ r, next: nextOccurrence(r, now, tz) }))
  const upcoming = withNext.filter(x => x.next).sort((a, b) => a.next!.getTime() - b.next!.getTime())
  const past = withNext.filter(x => !x.next).map(x => x.r).sort((a, b) => `${b.day}${b.at}`.localeCompare(`${a.day}${a.at}`))

  const openNew = () => { setEditing(null); setStart(freshReminder(new Date(), tz)) }
  const openEdit = (r: MyReminder) => { setEditing(r); setStart({ title: r.title, day: r.day, at: r.at.slice(0, 5), repeat: r.repeat }) }
  const close = () => {
    setStart(null); setEditing(null)
    // the Create menu's ?new=1 has done its job: without it, a reload does not open the dialog again
    if (fromAddress) window.history.replaceState(null, '', window.location.pathname)
  }

  async function save(input: ReminderInput) {
    const was = editing
    close()
    try {
      if (was) await updateReminder(supabase(), was.id, input)
      else {
        await createReminder(supabase(), input)
        // the first time, ask the browser to let reminders through as notifications when Studyhub is in another tab
        if (notificationPermission() === 'default') void askNotificationPermission()
      }
      announceRemindersChanged()
    } catch { toast('Could not save that reminder.') }
    await load()
  }
  async function remove(r: MyReminder) {
    try { await deleteReminder(supabase(), r.id); announceRemindersChanged(); toast('Reminder deleted.') } catch { toast('Could not delete that reminder.') }
    await load()
  }
  async function clearPast() {
    try { await deleteReminders(supabase(), past.map(r => r.id)); announceRemindersChanged() } catch { toast('Could not clear them.') }
    await load()
  }

  const row = (r: MyReminder, when: string) => (
    <li key={r.id} className="tile flex items-center gap-3 !py-3">
      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><Bell size={18} /></span>
      <span className="min-w-0 flex-1">
        <span data-title className="block truncate font-medium">{r.title}</span>
        <span className="block text-sm text-muted">{when} · {describeRepeat(r)}</span>
      </span>
      <button type="button" className="btn-ghost !px-2" aria-label={`Edit ${r.title}`} onClick={() => openEdit(r)}><Pencil size={15} aria-hidden /></button>
      <button type="button" className="btn-ghost !px-2 hover:!text-danger" aria-label={`Delete ${r.title}`} onClick={() => { void remove(r) }}><Trash2 size={15} aria-hidden /></button>
    </li>
  )

  return (
    <div>
      <PageHeader title="Reminders" actions={<button type="button" className="btn-primary" onClick={openNew}><Plus size={15} aria-hidden />New reminder</button>} />
      <p className="-mt-4 mb-6 text-[15px] text-muted">Reminders show while Studyhub is open in a tab, and as a notification when your browser allows it.</p>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-8">
          {failed && <p role="alert" className="text-sm text-danger">Could not load your reminders. <button type="button" className="underline" onClick={() => { void load() }}>Try again</button></p>}
          {rows && rows.length === 0 && (
            <EmptyState icon={BellRing} tone="b" title="No reminders yet" body="Set one for anything: a deadline, a call, a habit. Once, every day, on weekdays or every week.">
              <button type="button" className="btn-primary" onClick={openNew}><Plus size={15} aria-hidden />New reminder</button>
            </EmptyState>
          )}
          {upcoming.length > 0 && (
            <section aria-labelledby="rem-upcoming">
              <h2 id="rem-upcoming" className="section-label">Upcoming</h2>
              <ul aria-label="Upcoming" className="space-y-2">{upcoming.map(({ r, next }) => row(r, whenLabel(next!, tz, now)))}</ul>
            </section>
          )}
          {past.length > 0 && (
            <section aria-labelledby="rem-past">
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <h2 id="rem-past" className="section-label !mb-0">Past</h2>
                <button type="button" className="btn-ghost text-sm" onClick={() => { void clearPast() }}>Clear past</button>
              </div>
              <ul aria-label="Past" className="space-y-2 opacity-80">
                {past.map(r => row(r, formatInTimeZone(fromZonedTime(`${r.day}T${r.at.slice(0, 5)}:00`, tz), tz, 'EEE d MMM HH:mm')))}
              </ul>
            </section>
          )}
        </div>

        <section aria-label="Automatic reminders" className="card">
          <h2 className="section-label">Automatic reminders</h2>
          <p className="text-[15px] text-muted">
            {prefs.on ? 'On: ' : 'Off. When on, they cover '}tasks before they are due, exams, classes, cards to review, your daily goal and a morning plan.
          </p>
          <Link href="/settings?section=reminders" className="btn mt-4">{prefs.on ? 'Change them' : 'Set them up'}</Link>
        </section>
      </div>

      <ReminderDialog editing={editing} start={start} tz={tz} onClose={close} onSave={r => { void save(r) }} />
    </div>
  )
}
