'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell, BellRing, Pencil, Plus, Trash2 } from 'lucide-react'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { REMINDERS_CHANGED, announceRemindersChanged, deleteReminder, deleteReminders, listReminders } from '@/lib/data/reminders'
import { requestReminder } from '@/lib/reminders/events'
import { describeRepeat, nextOccurrence, whenLabel, type MyReminder } from '@/lib/reminders/mine'

// The student's own reminders, in the Planner: what is coming, soonest first, and the one-offs that have passed.
// They are made and changed in the reminder dialog the shell shows, so this list only reads and deletes.
export function RemindersList({ tz }: { tz: string }) {
  const toast = useToast()
  const [rows, setRows] = useState<MyReminder[] | null>(null)
  const [failed, setFailed] = useState(false)
  // the time the lists are drawn for, moved on every half minute, so a reminder whose time comes moves on without a reload
  const [now, setNow] = useState(() => new Date())

  const load = useCallback(async () => {
    try { setRows(await listReminders(supabase())); setFailed(false) } catch { setFailed(true) }
    setNow(new Date())
  }, [])
  useEffect(() => {
    let live = true
    listReminders(supabase()).then(r => { if (live) setRows(r) }).catch(() => { if (live) setFailed(true) })
    const tick = () => setNow(new Date())
    const every = setInterval(tick, 30_000)
    const changed = () => { void load() }
    window.addEventListener(REMINDERS_CHANGED, changed)
    document.addEventListener('visibilitychange', tick)
    return () => { live = false; clearInterval(every); window.removeEventListener(REMINDERS_CHANGED, changed); document.removeEventListener('visibilitychange', tick) }
  }, [load])

  const withNext = (rows ?? []).map(r => ({ r, next: nextOccurrence(r, now, tz) }))
  const upcoming = withNext.filter(x => x.next).sort((a, b) => a.next!.getTime() - b.next!.getTime())
  const past = withNext.filter(x => !x.next).map(x => x.r).sort((a, b) => `${b.day}${b.at}`.localeCompare(`${a.day}${a.at}`))

  async function remove(r: MyReminder) {
    try { await deleteReminder(supabase(), r.id); toast('Reminder deleted.') } catch { toast('Could not delete that reminder.') }
    announceRemindersChanged()
  }
  async function clearPast() {
    try { await deleteReminders(supabase(), past.map(r => r.id)) } catch { toast('Could not clear them.') }
    announceRemindersChanged()
  }

  const row = (r: MyReminder, when: string) => (
    <li key={r.id} className="group flex items-center gap-3 px-5 py-3">
      <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><Bell size={16} /></span>
      <span className="min-w-0 flex-1">
        <span data-title className="block truncate font-medium">{r.title}</span>
        <span className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
          <span>{when} · {describeRepeat(r)}</span>
          {r.href && r.link_label && <Link href={r.href} className="truncate text-accent hover:underline">{r.link_label}</Link>}
        </span>
      </span>
      <button type="button" className="btn-ghost !px-2" aria-label={`Edit ${r.title}`} onClick={() => requestReminder({ edit: r })}><Pencil size={15} aria-hidden /></button>
      <button type="button" className="btn-ghost !px-2 hover:!text-danger" aria-label={`Delete ${r.title}`} onClick={() => { void remove(r) }}><Trash2 size={15} aria-hidden /></button>
    </li>
  )
  const group = (label: string, items: React.ReactNode, action?: React.ReactNode) => (
    <section aria-label={label} className="overflow-hidden rounded-2xl border border-line bg-raised">
      <h3 className="font-display flex items-center justify-between px-5 pb-1.5 pt-4 text-sm font-semibold text-muted">{label}{action}</h3>
      <ul aria-label={label} className="divide-y divide-line">{items}</ul>
    </section>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Reminders show while Studyhub is open in a tab, and as a notification when your browser allows it.</p>
        <button type="button" className="btn-primary" onClick={() => requestReminder()}><Plus size={15} aria-hidden />New reminder</button>
      </div>
      {failed && <p role="alert" className="text-sm text-danger">Could not load your reminders. <button type="button" className="underline" onClick={() => { void load() }}>Try again</button></p>}
      {rows && rows.length === 0 && (
        <div className="rounded-2xl bg-surface px-4 py-8 text-center text-sm text-muted">
          <BellRing size={20} className="mx-auto mb-2 text-accent" aria-hidden />
          No reminders yet. Set one for a deadline, a call or a habit, or use “Remind me” on a task, a note or a deck.
        </div>
      )}
      {upcoming.length > 0 && group('Upcoming', upcoming.map(({ r, next }) => row(r, whenLabel(next!, tz, now))))}
      {past.length > 0 && group('Past', past.map(r => row(r, formatInTimeZone(fromZonedTime(`${r.day}T${r.at.slice(0, 5)}:00`, tz), tz, 'EEE d MMM HH:mm'))),
        <button type="button" className="btn-ghost !py-0.5 text-xs font-normal" onClick={() => { void clearPast() }}>Clear past</button>)}
    </div>
  )
}
