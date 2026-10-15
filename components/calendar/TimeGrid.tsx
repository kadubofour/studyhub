'use client'
import { useEffect, useRef } from 'react'
import { ItemChip } from './ItemChip'
import { classLanes, nowFraction, type DayItem } from '@/lib/calendar/events'
import { weekdayOfKey, type DayKey } from '@/lib/dates'
import { gridHours } from '@/lib/timetable'
import type { ClassSlot, Course } from '@/lib/types'

const HEADER_H = 60
const ROW_H = 24
const MIN_HOUR_PX = 30 // on a very short screen the hours stop shrinking here and the grid scrolls (without a scrollbar)
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`
const dayParts = (k: DayKey) => { const d = new Date(`${k}T12:00:00Z`); return { dow: d.getUTCDay(), n: d.getUTCDate(), month: d.getUTCMonth() } }
const longDay = (k: DayKey) => { const p = dayParts(k); return `${DAYS[p.dow]} ${p.n} ${MONTHS[p.month]}` }
export const tint = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, var(--raised))`

// Day and Week, laid out like a phone calendar: weekday and date on top (today in a filled circle), an all-day row, then the hours with
// thin lines and the classes as soft blocks with a colour bar. The hours stretch to fill the screen, so there is no scrollbar to speak of.
// `showStrip` and `showNow` are off for the weekly timetable, which has no dates.
export function TimeGrid({ keys, todayKey, now, tz, classes, courses, itemsByDay, onClassClick, onSlotClick, onItemClick, showStrip = true, showNow = true }: {
  keys: DayKey[]; todayKey: DayKey; now: Date; tz: string; classes: ClassSlot[]; courses: Course[]
  itemsByDay: Record<DayKey, DayItem[]>
  onClassClick: (c: ClassSlot) => void; onSlotClick: (key: DayKey, hour: number) => void; onItemClick: (i: DayItem) => void
  showStrip?: boolean; showNow?: boolean
}) {
  const { start: START_H, end: END_H } = gridHours(classes)
  const hours = Array.from({ length: END_H - START_H }, (_, i) => START_H + i)
  const totalMin = (END_H - START_H) * 60
  const courseOf = (id: string | null) => courses.find(c => c.id === id)
  const stripH = showStrip ? Math.max(1, ...keys.map(k => itemsByDay[k]?.length ?? 0)) * ROW_H + 8 : 0
  const fraction = showNow && keys.includes(todayKey) ? nowFraction(now, tz, START_H, END_H) : null
  const minHours = hours.length * MIN_HOUR_PX

  // Open with the current time in view when the screen is too short to show every hour
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scroller.current
    if (el && fraction !== null) el.scrollTop = Math.max(0, fraction * (el.scrollHeight - HEADER_H - stripH) - 140)
    // a week wider than the screen opens on today's column
    const col = el?.querySelector<HTMLElement>('[data-today="true"]')
    if (el && col && el.scrollWidth > el.clientWidth) el.scrollLeft = Math.max(0, col.offsetLeft - 56 - 8)
    // only when the grid first appears or its day/hours change, not every minute the line moves
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys[0], keys.length, START_H])

  return (
    <div ref={scroller} tabIndex={0} role="region" aria-label={showStrip ? 'Schedule' : 'Weekly timetable'}
      className="no-scrollbar overflow-auto rounded-2xl border border-line bg-raised" style={{ height: 'calc(100dvh - 12rem)', minHeight: HEADER_H + stripH + minHours }}>
      <div className={`flex min-h-full ${keys.length > 1 ? 'max-md:min-w-[46rem]' : ''}`}>
        <div className="sticky left-0 z-30 flex w-14 shrink-0 flex-col border-r border-line bg-raised" aria-hidden>
          <div className="sticky top-0 z-20 border-b border-line bg-raised" style={{ height: HEADER_H }} />
          {showStrip && <div className="sticky z-10 flex items-center justify-end border-b border-line bg-raised pr-2 text-[10px] text-muted" style={{ height: stripH, top: HEADER_H }}>all-day</div>}
          <div className="relative flex-1" style={{ minHeight: minHours }}>
            {hours.map(h => <div key={h} className="absolute right-2 -translate-y-1/2 text-[11px] text-muted" style={{ top: `${((h - START_H) / hours.length) * 100}%` }}>{h === START_H ? '' : hourLabel(h)}</div>)}
          </div>
        </div>
        {keys.map(k => {
          const { dow, n } = dayParts(k)
          const today = k === todayKey
          const dayClasses = classes.filter(c => c.day_of_week === weekdayOfKey(k))
          const lanes = classLanes(dayClasses)
          const items = itemsByDay[k] ?? []
          return (
            <div key={k} role="group" aria-label={longDay(k)} data-day={k} data-today={today ? 'true' : undefined} className="relative flex min-w-0 flex-1 flex-col border-l border-line first:border-l-0">
              <div className="sticky top-0 z-20 flex flex-col items-center justify-center gap-0.5 border-b border-line bg-raised" style={{ height: HEADER_H }}>
                <span className={`text-[11px] font-medium tracking-wide ${today ? 'text-accent' : 'text-muted'}`}>{DAYS[dow].slice(0, 3).toUpperCase()}</span>
                {showStrip && <span className={`flex size-8 items-center justify-center rounded-full text-lg leading-none ${today ? 'bg-accent-solid font-semibold text-white' : ''}`}>{n}</span>}
              </div>
              {showStrip && (
                <div className="sticky z-10 space-y-1 border-b border-line bg-raised p-1" style={{ height: stripH, top: HEADER_H }}>
                  {items.map(i => <ItemChip key={`${i.kind}-${i.id}`} item={i} course={courseOf(i.courseId)} onClick={() => onItemClick(i)} />)}
                </div>
              )}
              <div className="relative flex-1" style={{ minHeight: minHours }}>
                {hours.map(h => (
                  <div key={h} data-testid={`slot-${h}`} aria-hidden onClick={() => onSlotClick(k, h)}
                    className="absolute inset-x-0 cursor-pointer border-t border-line/70 first:border-t-0 hover:bg-surface/60"
                    style={{ top: `${((h - START_H) / hours.length) * 100}%`, height: `${100 / hours.length}%` }} />
                ))}
                {dayClasses.map(c => {
                  const top = ((toMin(c.start_time) - START_H * 60) / totalMin) * 100
                  const h = ((toMin(c.end_time) - toMin(c.start_time)) / totalMin) * 100
                  const course = courseOf(c.course_id)
                  const color = course?.color ?? '#888780'
                  const { lane, lanes: count } = lanes.get(c.id) ?? { lane: 0, lanes: 1 }
                  return (
                    <button key={c.id} type="button" onClick={() => onClassClick(c)}
                      className="absolute overflow-hidden rounded-md border-l-[3px] px-1.5 py-1 text-left text-[11px] leading-tight text-fg"
                      style={{ top: `${top}%`, height: `${h}%`, minHeight: 18, left: `calc(${(lane / count) * 100}% + 2px)`, width: `calc(${100 / count}% - 4px)`, borderLeftColor: color, background: tint(color, 20) }}>
                      <span className="block font-semibold">{course?.name ?? 'Class'}</span>
                      <span className="block">{c.start_time.slice(0, 5)}–{c.end_time.slice(0, 5)}{c.location ? ` · ${c.location}` : ''}</span>
                    </button>
                  )
                })}
                {today && fraction !== null && (
                  <div data-testid="now-line" aria-hidden className="pointer-events-none absolute inset-x-0 z-[5] h-0.5 bg-danger" style={{ top: `${fraction * 100}%` }}>
                    <span className="absolute -left-1 -top-[3px] size-2 rounded-full bg-danger" />
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
