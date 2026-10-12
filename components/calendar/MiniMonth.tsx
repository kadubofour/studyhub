'use client'
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { monthKeys, rangeTitle, shiftAnchor } from '@/lib/calendar/range'
import type { DayKey } from '@/lib/dates'

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const label = (k: DayKey) => {
  const d = new Date(`${k}T12:00:00Z`)
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

// A small month beside the calendar: pick a day to go there; the shown range is tinted and today is ringed
export function MiniMonth({ anchor, todayKey, rangeKeys, onPick }: { anchor: DayKey; todayKey: DayKey; rangeKeys: DayKey[]; onPick: (k: DayKey) => void }) {
  // The month being looked at follows the calendar, and can be turned without moving the calendar
  const [shown, setShown] = useState(anchor)
  const [seen, setSeen] = useState(anchor)
  if (anchor !== seen) { setSeen(anchor); if (anchor.slice(0, 7) !== shown.slice(0, 7)) setShown(anchor) }
  const keys = monthKeys(shown)
  const inRange = new Set(rangeKeys)
  return (
    <div className="w-52 select-none">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium">{rangeTitle('month', shown)}</span>
        <span className="flex">
          <button type="button" className="btn-ghost px-1" aria-label="Previous month" onClick={() => setShown(s => shiftAnchor('month', s, -1))}><ChevronLeft size={15} aria-hidden /></button>
          <button type="button" className="btn-ghost px-1" aria-label="Next month" onClick={() => setShown(s => shiftAnchor('month', s, 1))}><ChevronRight size={15} aria-hidden /></button>
        </span>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] text-muted" aria-hidden>{LETTERS.map((l, i) => <span key={i} className="py-1">{l}</span>)}</div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {keys.map(k => {
          const outside = k.slice(0, 7) !== shown.slice(0, 7)
          const today = k === todayKey
          return (
            <button key={k} type="button" aria-label={label(k)} aria-current={today ? 'date' : undefined} data-in-range={inRange.has(k) ? 'true' : undefined}
              onClick={() => onPick(k)}
              className={`mx-auto flex size-7 items-center justify-center rounded-full text-xs transition ${today ? 'bg-fg font-semibold text-bg' : inRange.has(k) ? 'bg-accent-soft text-accent' : outside ? 'text-muted/60 hover:bg-surface' : 'hover:bg-surface'}`}>
              {Number(k.slice(8))}
            </button>
          )
        })}
      </div>
    </div>
  )
}
