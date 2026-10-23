'use client'
import { useState } from 'react'
import { fromZonedTime } from 'date-fns-tz'
import { ReminderDialog, freshReminder } from './ReminderDialog'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { announceRemindersChanged, createReminder, updateReminder, type ReminderInput } from '@/lib/data/reminders'
import { askNotificationPermission, notificationPermission } from '@/lib/focus/alert'
import { useOpenReminder } from '@/lib/reminders/events'
import { nextOccurrence, whenLabel, type MyReminder } from '@/lib/reminders/mine'

// Lives in the app shell: the reminder dialog over whatever page asked for it (see docs/superpowers/specs/2026-10-30-my-reminders-design.md)
export function ReminderHost() {
  const { profile } = useProfile()
  const toast = useToast()
  const tz = profile.timezone
  const [editing, setEditing] = useState<MyReminder | null>(null)
  const [start, setStart] = useState<ReminderInput | null>(null)

  useOpenReminder(ask => {
    if (ask?.edit) {
      const r = ask.edit
      setEditing(r); setStart({ title: r.title, day: r.day, at: r.at.slice(0, 5), repeat: r.repeat, href: r.href ?? null, link_label: r.link_label ?? null })
      return
    }
    const fresh = freshReminder(new Date(), tz)
    setEditing(null)
    setStart({ ...fresh, title: ask?.title ?? '', day: ask?.day ?? fresh.day, href: ask?.href ?? null, link_label: ask?.link_label ?? null })
  })
  const close = () => { setStart(null); setEditing(null) }

  // The dialog closes once it is saved; if saving fails it stays open with what was typed
  async function save(input: ReminderInput) {
    try {
      if (editing) await updateReminder(supabase(), editing.id, input)
      else {
        await createReminder(supabase(), input)
        // the first time, ask the browser to let reminders through as notifications when Studyhub is in another tab
        if (notificationPermission() === 'default') void askNotificationPermission()
      }
    } catch { toast('Could not save that reminder.'); return }
    close()
    announceRemindersChanged()
    const now = new Date()
    const next = nextOccurrence({ id: '', ...input }, now, tz) ?? fromZonedTime(`${input.day}T${input.at}:00`, tz)
    toast(`Reminder set for ${whenLabel(next, tz, now)}.`)
  }

  return <ReminderDialog editing={editing} start={start} tz={tz} onClose={close} onSave={r => { void save(r) }} />
}
