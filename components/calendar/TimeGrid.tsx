'use client'
import { useEffect, useRef } from 'react'
import { ItemChip } from './ItemChip'
import { classLanes, nowOffsetPx, type DayItem } from '@/lib/calendar/events'
import { weekdayOfKey, type DayKey } from '@/lib/dates'
import { gridHours } from '@/lib/timetable'
import type { ClassSlot, Course } from '@/lib/types'

export const PX_PER_H = 48
const HEADER_H = 52
const ROW_H = 24
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const SHORT_DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const longDay = (k: DayKey) => { const d = new Date(`${k}T12:00:00Z`); return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}` }
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`

// Day and Week: an all-day strip for deadlines and study sessions, then the hours with classes as blocks and a line at the current time
export function TimeGrid({ keys, todayKey, now, tz, classes, courses, itemsByDay, onClassClick, onSlotClick, onItemClick }: {
  keys: DayKey[]; todayKey: DayKey; now: Date; tz: string; classes: ClassSlot[]; courses: Course[]
  itemsByDay: Record<DayKey, DayItem[]>
  onClassClick: (c: ClassSlot) => void; onSlotClick: (key: DayKey, hour: number) => void; onItemClick: (i: DayItem) => void
}) {
  const { start: START_H, end: END_H } = gridHours(classes)
  const hours = Array.from({ length: END_H - START_H }, (_, i) => START_H + i)
  const height = (END_H - START_H) * PX_PER_H
  const courseOf = (id: string | null) => courses.find(c => c.id === id)
  const stripH = Math.max(1, ...keys.map(k => itemsByDay[k]?.length ?? 0)) * ROW_H + 8
  const line = keys.includes(todayKey) ? nowOffsetPx(now, tz, START_H, END_H, PX_PER_H) : null

  // Open with the current time in view (or the morning when today is not shown)
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = line === null ? 0 : Math.max(0, line - 140)
    // only when the grid first appears or its day/hours change, not every minute the line moves
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys[0], keys.length, START_H])

  return (
    <div ref={scroller} className="max-h-[68vh] overflow-auto rounded-2xl border border-line bg-raised">
      <div className={`flex ${keys.length > 1 ? 'min-w-[680px]' : ''}`}>
        <div className="w-14 shrink-0" aria-hidden>
          <div style={{ height: HEADER_H + stripH }} className="sticky top-0 z-20 bg-raised" />
          <div className="relative" style={{ height }}>
            {hours.map(h => <div key={h} className="absolute right-2 -translate-y-2 text-[11px] text-muted" style={{ top: (h - START_H) * PX_PER_H }}>{h === START_H ? '' : hourLabel(h)}</div>)}
          </div>
        </div>
        {keys.map(k => {
          const dow = weekdayOfKey(k)
          const today = k === todayKey
          const dayClasses = classes.filter(c => c.day_of_week === dow)
          const lanes = classLanes(dayClasses)
          const items = itemsByDay[k] ?? []
          const d = new Date(`${k}T12:00:00Z`)
          return (
            <div key={k} role="group" aria-label={longDay(k)} data-day={k} data-today={today ? 'true' : undefined}
              className={`relative min-w-0 flex-1 border-l border-line ${today ? 'bg-accent-soft/40' : ''}`}>
              <div className="sticky top-0 z-10 flex flex-col items-center justify-center border-b border-line bg-raised" style={{ height: HEADER_H }}>
                <span className="text-[11px] tracking-wide text-muted" aria-hidden>{SHORT_DAYS[d.getUTCDay()]}</span>
                <span aria-hidden className={`flex size-8 items-center justify-center rounded-full text-lg ${today ? 'bg-fg font-semibold text-bg' : ''}`}>{d.getUTCDate()}</span>
              </div>
              <div className="space-y-0.5 border-b border-line p-1" style={{ minHeight: stripH }}>
                {items.map(i => <ItemChip key={`${i.kind}-${i.id}`} item={i} course={courseOf(i.courseId)} onClick={() => onItemClick(i)} />)}
              </div>
              <div className="relative" style={{ height }}>
                {hours.map(h => (
                  <div key={h} data-testid={`slot-${h}`} aria-hidden onClick={() => onSlotClick(k, h)}
                    className="absolute inset-x-0 cursor-pointer border-t border-line/70 hover:bg-surface/60" style={{ top: (h - START_H) * PX_PER_H, height: PX_PER_H }} />
                ))}
                {dayClasses.map(c => {
                  const top = ((toMin(c.start_time) - START_H * 60) / 60) * PX_PER_H
                  const h = ((toMin(c.end_time) - toMin(c.start_time)) / 60) * PX_PER_H
                  const course = courseOf(c.course_id)
                  const { lane, lanes: n } = lanes.get(c.id) ?? { lane: 0, lanes: 1 }
                  return (
                    <button key={c.id} type="button" onClick={() => onClassClick(c)}
                      className="absolute overflow-hidden rounded-md px-1.5 py-0.5 text-left text-[11px] leading-tight text-white shadow-sm"
                      style={{ top: Math.max(0, top), height: Math.max(18, h - 2), left: `calc(${(lane / n) * 100}% + 2px)`, width: `calc(${100 / n}% - 4px)`, background: course?.color ?? '#888780' }}>
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
