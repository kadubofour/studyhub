'use client'
import { ItemChip } from './ItemChip'
import type { DayItem } from '@/lib/calendar/events'
import { weekdayOfKey, type DayKey } from '@/lib/dates'
import type { ClassSlot, Course } from '@/lib/types'

const SHOWN = 3
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const HEAD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const longDay = (k: DayKey) => { const d = new Date(`${k}T12:00:00Z`); return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}` }

// Month: a cell per day with its classes and deadlines (three, then "+N more"); the day number opens that day
export function MonthGrid({ keys, anchor, todayKey, classes, courses, itemsByDay, onDayClick, onItemClick, onClassClick }: {
  keys: DayKey[]; anchor: DayKey; todayKey: DayKey; classes: ClassSlot[]; courses: Course[]; itemsByDay: Record<DayKey, DayItem[]>
  onDayClick: (k: DayKey) => void; onItemClick: (i: DayItem) => void; onClassClick: (c: ClassSlot) => void
}) {
  const courseOf = (id: string | null) => courses.find(c => c.id === id)
  const month = anchor.slice(0, 7)
  return (
    <div tabIndex={0} role="region" aria-label="Month" className="overflow-auto" style={{ minHeight: 420 }}>
      <div className="min-w-[640px]">
        <div className="grid grid-cols-7 gap-1 pb-1 text-center text-xs font-medium text-muted" aria-hidden>
          {HEAD.map(h => <span key={h} className="py-1.5">{h}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {keys.map(k => {
            const outside = k.slice(0, 7) !== month
            const dow = weekdayOfKey(k)
            const entries: { id: string; node: React.ReactNode }[] = [
              ...classes.filter(c => c.day_of_week === dow).sort((a, b) => a.start_time.localeCompare(b.start_time)).map(c => ({
                id: `c-${c.id}`,
                node: (
                  <button type="button" onClick={() => onClassClick(c)} className="flex w-full items-center gap-1 truncate rounded-md px-1.5 py-px text-left text-[11px] text-white" style={{ background: courseOf(c.course_id)?.color ?? '#888780' }}>
                    <span className="shrink-0 opacity-90">{c.start_time.slice(0, 5)}</span><span className="truncate">{courseOf(c.course_id)?.name ?? 'Class'}</span>
                  </button>
                ),
              })),
              ...(itemsByDay[k] ?? []).map(i => ({ id: `${i.kind}-${i.id}`, node: <ItemChip item={i} course={courseOf(i.courseId)} compact onClick={() => onItemClick(i)} /> })),
            ]
            const hidden = entries.length - SHOWN
            return (
              <div key={k} data-day={k} className={`min-h-32 space-y-0.5 rounded-lg p-1 ${outside ? 'bg-surface/50' : 'bg-surface'}`}>
                <button type="button" aria-label={longDay(k)} aria-current={k === todayKey ? 'date' : undefined} data-outside={outside ? 'true' : undefined} onClick={() => onDayClick(k)}
                  className={`flex size-6 items-center justify-center rounded-full text-xs hover:bg-surface ${k === todayKey ? 'bg-fg font-semibold text-bg hover:bg-fg' : outside ? 'text-muted' : ''}`}>
                  {Number(k.slice(8))}
                </button>
                {entries.slice(0, SHOWN).map(e => <div key={e.id}>{e.node}</div>)}
                {hidden > 0 && (
                  <button type="button" aria-label={`${hidden} more on ${longDay(k)}`} onClick={() => onDayClick(k)} className="px-1.5 text-[11px] text-muted hover:text-fg">+{hidden} more</button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
