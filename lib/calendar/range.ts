import { addDaysToKey, weekKeysFor, type DayKey } from '@/lib/dates'

export type CalView = 'day' | 'week' | 'month'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const SHORT = MONTHS.map(m => m.slice(0, 3))
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const parts = (key: DayKey) => ({ y: Number(key.slice(0, 4)), m: Number(key.slice(5, 7)) - 1, d: Number(key.slice(8, 10)) })
const pad = (n: number) => String(n).padStart(2, '0')
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
const keyOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`

// Whole Monday-to-Sunday weeks that cover the month of `anchor`
export function monthKeys(anchor: DayKey): DayKey[] {
  const { y, m } = parts(anchor)
  const first = keyOf(y, m, 1)
  const last = keyOf(y, m, daysIn(y, m))
  const start = weekKeysFor(first)[0]
  const end = weekKeysFor(last)[6]
  const out: DayKey[] = []
  for (let k = start; k <= end; k = addDaysToKey(k, 1)) out.push(k)
  return out
}

export function visibleKeys(view: CalView, anchor: DayKey): DayKey[] {
  if (view === 'day') return [anchor]
  return view === 'week' ? weekKeysFor(anchor) : monthKeys(anchor)
}

// One day, week or month forward (+1) or back (-1); a month end stays inside the shorter month
export function shiftAnchor(view: CalView, anchor: DayKey, dir: 1 | -1): DayKey {
  if (view === 'day') return addDaysToKey(anchor, dir)
  if (view === 'week') return addDaysToKey(anchor, 7 * dir)
  const { y, m, d } = parts(anchor)
  const total = y * 12 + m + dir
  const ny = Math.floor(total / 12)
  const nm = total - ny * 12
  return keyOf(ny, nm, Math.min(d, daysIn(ny, nm)))
}

export function rangeTitle(view: CalView, anchor: DayKey): string {
  const a = parts(anchor)
  if (view === 'month') return `${MONTHS[a.m]} ${a.y}`
  if (view === 'day') return `${DAYS[new Date(Date.UTC(a.y, a.m, a.d)).getUTCDay()]}, ${SHORT[a.m]} ${a.d}, ${a.y}`
  const week = weekKeysFor(anchor)
  const s = parts(week[0]), e = parts(week[6])
  if (s.y !== e.y) return `${SHORT[s.m]} ${s.d}, ${s.y} – ${SHORT[e.m]} ${e.d}, ${e.y}`
  if (s.m !== e.m) return `${SHORT[s.m]} ${s.d} – ${SHORT[e.m]} ${e.d}, ${e.y}`
  return `${SHORT[s.m]} ${s.d} – ${e.d}, ${e.y}`
}
