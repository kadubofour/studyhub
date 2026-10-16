import { localStore, useLocalStore } from '@/lib/ui/localStore'

/** Minutes before the moment */
export const TASK_LEADS = [0, 15, 60, 180, 1440] as const
export const EXAM_LEADS = [60, 180, 1440, 2880] as const
export const CLASS_LEADS = [5, 10, 15, 30] as const

export interface QuietHours { from: string; to: string }

/** What Studyhub reminds the student about: all kept on this device */
export interface ReminderPrefs {
  /** The master switch: nothing is shown until the student turns reminders on */
  on: boolean
  /** Before a task is due (minutes), or off */
  taskLead: number | null
  /** An extra, earlier reminder for exams (minutes), or off */
  examLead: number | null
  /** Before a class starts (minutes), or off */
  classLead: number | null
  /** Once a day, at "HH:mm" in the student's time zone, or off */
  cards: string | null
  goal: string | null
  morning: string | null
  /** No reminders between these times, or off */
  quiet: QuietHours | null
}

export const DEFAULT_REMINDERS: ReminderPrefs = {
  on: false, taskLead: 60, examLead: 1440, classLead: 10, cards: '18:00', goal: '20:00', morning: '08:00', quiet: { from: '22:00', to: '07:00' },
}

export const isHHMM = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)

export function parseReminders(v: unknown): ReminderPrefs {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  const d = DEFAULT_REMINDERS
  const off = (x: unknown) => x === null || x === false
  const lead = (k: 'taskLead' | 'examLead' | 'classLead', allowed: readonly number[]) =>
    off(o[k]) ? null : typeof o[k] === 'number' && allowed.includes(o[k] as number) ? (o[k] as number) : d[k]
  const time = (k: 'cards' | 'goal' | 'morning') => (off(o[k]) ? null : isHHMM(o[k]) ? (o[k] as string) : d[k])
  const q = o.quiet as Partial<QuietHours> | null | undefined
  const quiet = q === null ? null : q && isHHMM(q.from) && isHHMM(q.to) ? { from: q.from, to: q.to } : d.quiet
  return {
    on: o.on === true, taskLead: lead('taskLead', TASK_LEADS), examLead: lead('examLead', EXAM_LEADS), classLead: lead('classLead', CLASS_LEADS),
    cards: time('cards'), goal: time('goal'), morning: time('morning'), quiet,
  }
}

export const reminderPrefs = localStore<ReminderPrefs>('studyhub.reminders.prefs', DEFAULT_REMINDERS, parseReminders)
export const setReminderPrefs = (patch: Partial<ReminderPrefs>) => reminderPrefs.set({ ...reminderPrefs.get(), ...patch })
export const useReminderPrefs = () => useLocalStore(reminderPrefs)
