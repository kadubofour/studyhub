'use client'
import { useEffect, useRef } from 'react'
import { ItemChip } from './ItemChip'
import { classLanes, nowOffsetPx, type DayItem } from '@/lib/calendar/events'
import { weekdayOfKey, type DayKey } from '@/lib/dates'
import { gridHours } from '@/lib/timetable'
import type { ClassSlot, Course } from '@/lib/types'

export const PX_PER_H = 56
const HEADER_H = 32
const ROW_H = 24
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`
const dayParts = (k: DayKey) => { const d = new Date(`${k}T12:00:00Z`); return { dow: d.getUTCDay(), n: d.getUTCDate(), month: d.getUTCMonth() } }
const longDay = (k: DayKey) => { const p = dayParts(k); return `${DAYS[p.dow]} ${p.n} ${MONTHS[p.month]}` }

// Day and Week: the days side by side in soft columns, deadlines and study sessions on top, classes as coloured blocks in the hours.
// It fills the screen. `showStrip` and `showNow` are off for the weekly timetable, which has no dates.
export function TimeGrid({ keys, todayKey, now, tz, classes, courses, itemsByDay, onClassClick, onSlotClick, onItemClick, showStrip = true, showNow = true }: {
  keys: DayKey[]; todayKey: DayKey; now: Date; tz: string; classes: ClassSlot[]; courses: Course[]
  itemsByDay: Record<DayKey, DayItem[]>
  onClassClick: (c: ClassSlot) => void; onSlotClick: (key: DayKey, hour: number) => void; onItemClick: (i: DayItem) => void
  showStrip?: boolean; showNow?: boolean
}) {
  const { start: START_H, end: END_H } = gridHours(classes)
  const hours = Array.from({ length: END_H - START_H }, (_, i) => START_H + i)
  const height = (END_H - START_H) * PX_PER_H
  const courseOf = (id: string | null) => courses.find(c => c.id === id)
  const stripH = showStrip ? Math.max(1, ...keys.map(k => itemsByDay[k]?.length ?? 0)) * ROW_H + 8 : 0
  const line = showNow && keys.includes(todayKey) ? nowOffsetPx(now, tz, START_H, END_H, PX_PER_H) : null

  // Open with the current time in view (or the morning when today is not shown)
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = line === null ? 0 : Math.max(0, line - 140)
    // only when the grid first appears or its day/hours change, not every minute the line moves
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys[0], keys.length, START_H])

  return (
    <div ref={scroller} tabIndex={0} role="region" aria-label={showStrip ? 'Schedule' : 'Weekly timetable'} className="overflow-auto" style={{ height: 'calc(100dvh - 15rem)', minHeight: 420 }}>
      <div className={`flex gap-1 ${keys.length > 1 ? 'min-w-[720px]' : ''}`}>
        <div className="w-12 shrink-0" aria-hidden>
          <div style={{ height: HEADER_H + stripH }} className="sticky top-0 z-20 bg-bg" />
          <div className="relative" style={{ height }}>
            {hours.map(h => <div key={h} className="absolute right-1 -translate-y-2 text-[11px] text-muted" style={{ top: (h - START_H) * PX_PER_H }}>{h === START_H ? '' : hourLabel(h)}</div>)}
          </div>
        </div>
        {keys.map(k => {
          const { dow, n } = dayParts(k)
          const today = k === todayKey
          const dayClasses = classes.filter(c => c.day_of_week === weekdayOfKey(k))
          const lanes = classLanes(dayClasses)
          const items = itemsByDay[k] ?? []
          return (
            <div key={k} role="group" aria-label={longDay(k)} data-day={k} data-today={today ? 'true' : undefined} className="relative min-w-0 flex-1">
              <div className={`sticky top-0 z-20 bg-bg text-center text-xs font-medium ${today ? 'text-accent' : ''}`} style={{ height: HEADER_H, lineHeight: `${HEADER_H}px` }}>
                {`${DAYS[dow].slice(0, 3)} ${n}`}
              </div>
              {showStrip && (
                <div className="sticky z-10 space-y-1 bg-bg pb-1" style={{ minHeight: stripH, top: HEADER_H }}>
                  {items.map(i => <ItemChip key={`${i.kind}-${i.id}`} item={i} course={courseOf(i.courseId)} onClick={() => onItemClick(i)} />)}
                </div>
              )}
              <div className={`relative rounded-lg ${today ? 'bg-accent-soft' : 'bg-surface'}`} style={{ height }}>
                {hours.map(h => (
                  <div key={h} data-testid={`slot-${h}`} aria-hidden onClick={() => onSlotClick(k, h)}
                    className="absolute inset-x-0 cursor-pointer border-t border-line/60 first:border-t-0 hover:bg-bg/50" style={{ top: (h - START_H) * PX_PER_H, height: PX_PER_H }} />
                ))}
                {dayClasses.map(c => {
                  const top = ((toMin(c.start_time) - START_H * 60) / 60) * PX_PER_H
                  const h = ((toMin(c.end_time) - toMin(c.start_time)) / 60) * PX_PER_H
                  const course = courseOf(c.course_id)
                  const { lane, lanes: count } = lanes.get(c.id) ?? { lane: 0, lanes: 1 }
                  return (
                    <button key={c.id} type="button" onClick={() => onClassClick(c)}
                      className="absolute overflow-hidden rounded-md px-1.5 py-0.5 text-left text-[11px] leading-tight text-white"
                      style={{ top: Math.max(0, top), height: Math.max(18, h - 2), left: `calc(${(lane / count) * 100}% + 2px)`, width: `calc(${100 / count}% - 4px)`, background: course?.color ?? '#888780' }}>
                      <span className="font-medium">{course?.name ?? 'Class'}</span><br />
                      <span className="opacity-90">{c.start_time.slice(0, 5)}–{c.end_time.slice(0, 5)}{c.location ? ` · ${c.location}` : ''}</span>
                    </button>
                  )
                })}
                {today && line !== null && (
                  <div data-testid="now-line" aria-hidden className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-danger" style={{ top: line }}>
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
