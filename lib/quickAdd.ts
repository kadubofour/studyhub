import { addDaysToKey, endOfLocalDay, localDayKey, weekdayOfKey, weekKeysFor } from './dates'

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
// Words people put before a date that shouldn't stay in the title ("Essay due fri")
const FILLERS = ['due', 'by', 'on']

const prefixIndex = (list: string[], word: string) =>
  word.length >= 3 ? list.findIndex(full => full.startsWith(word)) : -1

function validKey(y: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, m, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m || dt.getUTCDate() !== d) return null
  return dt.toISOString().slice(0, 10)
}

function stripFillers(words: string[]): string[] {
  const out = [...words]
  while (out.length > 1 && FILLERS.includes(out[out.length - 1].toLowerCase())) out.pop()
  return out
}

export function parseQuickAdd(input: string, tz: string, now: Date): { title: string; dueAt: string | null } {
  const words = input.trim().split(/\s+/).filter(Boolean)
  const todayKey = localDayKey(now, tz)
  const done = (titleWords: string[], key: string) =>
    ({ title: stripFillers(titleWords).join(' '), dueAt: endOfLocalDay(key, tz).toISOString() })

  if (words.length >= 3) {
    const a = words[words.length - 2].toLowerCase()
    const b = words[words.length - 1].toLowerCase()

    // "next fri" → Friday of the following Mon–Sun week
    const nextWd = a === 'next' ? prefixIndex(WEEKDAYS, b) : -1
    if (nextWd >= 0) {
      const nextMonday = addDaysToKey(weekKeysFor(todayKey)[0], 7)
      return done(words.slice(0, -2), addDaysToKey(nextMonday, (nextWd + 6) % 7))
    }

    let month = prefixIndex(MONTHS, a), day = Number(b)
    if (month < 0 || !Number.isInteger(day)) { month = prefixIndex(MONTHS, b); day = Number(a) }
    if (month >= 0 && Number.isInteger(day)) {
      const year = Number(todayKey.slice(0, 4))
      let key = validKey(year, month, day)
      if (key && key < todayKey) key = validKey(year + 1, month, day)
      if (key) return done(words.slice(0, -2), key)
    }
  }

  if (words.length >= 2) {
    const last = words[words.length - 1].toLowerCase()
    const rest = words.slice(0, -1)
    if (last === 'today') return done(rest, todayKey)
    if (['tomorrow', 'tmr', 'tmrw'].includes(last)) return done(rest, addDaysToKey(todayKey, 1))
    const wd = prefixIndex(WEEKDAYS, last)
    if (wd >= 0) return done(rest, addDaysToKey(todayKey, (wd - weekdayOfKey(todayKey) + 7) % 7))
  }

  return { title: words.join(' '), dueAt: null }
}
