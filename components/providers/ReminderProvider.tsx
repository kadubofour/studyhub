'use client'
import { createContext, useCallback, useContext, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { useFocus } from '@/components/providers/FocusProvider'
import { supabase } from '@/lib/supabase/client'
import { listOpenTasks } from '@/lib/data/tasks'
import { listClasses } from '@/lib/data/classes'
import { listDecksWithDue } from '@/lib/data/decks'
import { notify } from '@/lib/focus/alert'
import { localStore } from '@/lib/ui/localStore'
import { dueReminders, type Reminder } from '@/lib/reminders/engine'
import { dueMine, type MyReminder } from '@/lib/reminders/mine'
import { listReminders, REMINDERS_CHANGED } from '@/lib/data/reminders'
import { reminderPrefs, useReminderPrefs } from '@/lib/reminders/prefs'
import type { ClassSlot, Task } from '@/lib/types'

const CHECK_MS = 30_000
const RELOAD_MS = 5 * 60_000
const REMEMBER_MS = 3 * 24 * 60 * 60_000

// Which reminders have been shown, on this device, so a reload or a second tab does not show one twice
const parseShown = (v: unknown): Record<string, number> => {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  return Object.fromEntries(Object.entries(o).filter(([, t]) => typeof t === 'number')) as Record<string, number>
}
export const shownReminders = localStore<Record<string, number>>('studyhub.reminders.shown', {}, parseShown)

interface Ctx { /** Shows a reminder now, so the student can see what one looks like */ test: () => void }
const ReminderCtx = createContext<Ctx>({ test: () => {} })
export const useReminders = () => useContext(ReminderCtx)

// Lives in the app layout: while Studyhub is open in any tab, it tells the student what is coming up (see docs/superpowers/specs/2026-10-18-reminders-design.md)
export function ReminderProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useProfile()
  const { todayMinutes } = useFocus()
  const toast = useToast()
  const router = useRouter()
  const prefs = useReminderPrefs()
  const data = useRef<{ tasks: Task[]; classes: ClassSlot[]; dueCards: number }>({ tasks: [], classes: [], dueCards: 0 })
  // the student's own reminders: shown whether or not the automatic ones are on
  const mine = useRef<MyReminder[]>([])
  const live = useRef({ todayMinutes, profile })
  useEffect(() => { live.current = { todayMinutes, profile } })

  // Several at once are one message (the page holds one toast, and the next would replace the last); each also gets its own notification
  const show = useCallback((rs: Reminder[], notification = true) => {
    if (rs.length === 0) return
    if (notification && document.visibilityState !== 'visible') rs.forEach(r => notify(r.title, r.body, { tag: r.key, onClick: () => router.push(r.href) }))
    const message = rs.length === 1 ? `${rs[0].title}: ${rs[0].body}` : `${rs.length} reminders: ${rs.map(r => r.title).join(', ')}`
    toast(message, { label: 'Open', onClick: () => router.push(rs[0].href) })
  }, [toast, router])

  const check = useCallback(() => {
    const { todayMinutes: minutes, profile: p } = live.current
    const now = new Date()
    const visible = document.visibilityState === 'visible'
    const shown = shownReminders.get()
    const id = (r: Reminder) => `${p.id}|${r.key}`
    // A tab that is not being looked at records its reminders as negative: the student has had the notification but not seen the page say it,
    // so the first tab they look at shows it once more (without another notification)
    const due = [
      ...dueReminders({ now, tz: p.timezone, prefs: reminderPrefs.get(), ...data.current, todayMinutes: minutes, goalMinutes: p.daily_goal_minutes }),
      ...dueMine(mine.current, now, p.timezone),
    ]
    const fresh = due.filter(r => shown[id(r)] === undefined)
    const unseen = visible ? due.filter(r => (shown[id(r)] ?? 0) < 0) : []
    if (fresh.length === 0 && unseen.length === 0) return
    const kept = Object.fromEntries(Object.entries(shown).filter(([, t]) => now.getTime() - Math.abs(t) < REMEMBER_MS))
    for (const r of [...fresh, ...unseen]) kept[id(r)] = visible ? now.getTime() : -now.getTime()
    shownReminders.set(kept)
    show(fresh)
    show(unseen, false)
  }, [show])

  const uid = profile.id
  useEffect(() => {
    let live = true
    const on = prefs.on
    let last = 0
    const load = () => {
      last = Date.now()
      const sb = supabase()
      // the student's own reminders always; what the automatic ones need only while they are on. Read together, so one check sees it all.
      const automatic = on ? Promise.all([listOpenTasks(sb), listClasses(sb), listDecksWithDue(sb, new Date())]) : Promise.resolve(null)
      Promise.all([listReminders(sb), automatic])
        .then(([rs, auto]) => {
          if (!live) return
          mine.current = rs
          data.current = auto ? { tasks: auto[0], classes: auto[1], dueCards: auto[2].reduce((n, d) => n + d.due, 0) } : { tasks: [], classes: [], dueCards: 0 }
          check()
        })
        .catch(() => { /* offline: the next try will do */ })
    }
    load()
    const reload = setInterval(load, RELOAD_MS)
    const tick = setInterval(check, CHECK_MS)
    // coming back to the tab reads again only after a minute away, so glancing between tabs costs nothing
    const back = () => { if (document.visibilityState === 'visible' && Date.now() - last > 60_000) load() }
    document.addEventListener('visibilitychange', back)
    window.addEventListener(REMINDERS_CHANGED, load)
    return () => { live = false; clearInterval(reload); clearInterval(tick); document.removeEventListener('visibilitychange', back); window.removeEventListener(REMINDERS_CHANGED, load) }
  }, [prefs.on, uid, check])

  const test = useCallback(() => show([{ key: `test:${Date.now()}`, title: 'Reminders are on', body: 'This is what a reminder looks like.', href: '/settings?section=reminders' }]), [show])

  return <ReminderCtx.Provider value={{ test }}>{children}</ReminderCtx.Provider>
}
