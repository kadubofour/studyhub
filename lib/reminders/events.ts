'use client'
import { useEffect, useRef } from 'react'
import type { MyReminder } from './mine'

/** What a "Remind me" fills in: the words, the day, and what it is about. `edit` opens an existing reminder instead. */
export type ReminderAsk = { title?: string; day?: string; href?: string; link_label?: string; edit?: MyReminder }

// Any part of the app can ask for the reminder dialog (the Create menu, a task, a note, a deck); the shell shows it over the page
export const OPEN_REMINDER = 'studyhub:open-reminder'
export const requestReminder = (ask?: ReminderAsk) => { window.dispatchEvent(new CustomEvent<ReminderAsk | undefined>(OPEN_REMINDER, { detail: ask })) }
export function useOpenReminder(open: (ask: ReminderAsk | undefined) => void) {
  const latest = useRef(open)
  useEffect(() => { latest.current = open })
  useEffect(() => {
    const heard = (e: Event) => latest.current((e as CustomEvent<ReminderAsk | undefined>).detail)
    window.addEventListener(OPEN_REMINDER, heard)
    return () => window.removeEventListener(OPEN_REMINDER, heard)
  }, [])
}
