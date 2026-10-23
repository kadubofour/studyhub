import type { SupabaseClient } from '@supabase/supabase-js'
import type { MyReminder, Repeat } from '@/lib/reminders/mine'
import { check, must } from './util'

const COLS = 'id,title,day,at,repeat,href,link_label'
/** href and link_label: what it is about, if anything (a page inside Studyhub and its name) */
export type ReminderInput = { title: string; day: string; at: string; repeat: Repeat; href?: string | null; link_label?: string | null }

// Soonest day first, then by time
export async function listReminders(sb: SupabaseClient): Promise<MyReminder[]> {
  return must(await sb.from('reminders').select(COLS).order('day').order('at').order('id'))
}

export async function createReminder(sb: SupabaseClient, r: ReminderInput): Promise<MyReminder> {
  return must(await sb.from('reminders').insert({ ...r, title: r.title.trim() }).select(COLS).single())
}

export async function updateReminder(sb: SupabaseClient, id: string, patch: Partial<ReminderInput>): Promise<void> {
  check(await sb.from('reminders').update(patch.title === undefined ? patch : { ...patch, title: patch.title.trim() }).eq('id', id))
}

export async function deleteReminder(sb: SupabaseClient, id: string): Promise<void> {
  check(await sb.from('reminders').delete().eq('id', id))
}

export async function deleteReminders(sb: SupabaseClient, ids: string[]): Promise<void> {
  if (!ids.length) return
  check(await sb.from('reminders').delete().in('id', ids))
}

// Pages that change reminders say so, and the reminder checker reads them again
export const REMINDERS_CHANGED = 'studyhub:reminders-changed'
export const announceRemindersChanged = () => window.dispatchEvent(new Event(REMINDERS_CHANGED))
