'use client'
import { ItemChip } from './ItemChip'
import type { DayItem } from '@/lib/calendar/events'
import { weekdayOfKey, type DayKey } from '@/lib/dates'
import type { ClassSlot, Course } from '@/lib/types'

const SHOWN = 2 // what a cell always has room for, with its "+N more"
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const HEAD = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const longDay = (k: DayKey) => { const d = new Date(`${k}T12:00:00Z`); return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}` }

// Month, like a phone calendar: ruled cells that stretch to fill the screen, the date in a corner (today in a filled circle), events as small pills
export function MonthGrid({ keys, anchor, todayKey, classes, courses, itemsByDay, onDayClick, onItemClick, onClassClick }: {
  keys: DayKey[]; anchor: DayKey; todayKey: DayKey; classes: ClassSlot[]; courses: Course[]; itemsByDay: Record<DayKey, DayItem[]>
  onDayClick: (k: DayKey) => void; onItemClick: (i: DayItem) => void; onClassClick: (c: ClassSlot) => void
}) {
  const courseOf = (id: string | null) => courses.find(c => c.id === id)
  const month = anchor.slice(0, 7)
  const rows = keys.length / 7
  return (
    <div tabIndex={0} role="region" aria-label="Month" className="no-scrollbar flex flex-col overflow-auto rounded-2xl border border-line bg-raised" style={{ height: 'calc(100dvh - 12rem)', minHeight: Math.max(380, rows * 84 + 32) }}>
      <div className="grid shrink-0 grid-cols-7 border-b border-line text-center text-[11px] font-medium tracking-wide text-muted" aria-hidden>
        {HEAD.map(h => <span key={h} className="py-2">{h}</span>)}
      </div>
      <div className="grid flex-1 grid-cols-7" style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}>
        {keys.map((k, i) => {
          const outside = k.slice(0, 7) !== month
          const dow = weekdayOfKey(k)
          const entries: { id: string; node: React.ReactNode }[] = [
            ...classes.filter(c => c.day_of_week === dow).sort((a, b) => a.start_time.localeCompare(b.start_time)).map(c => ({
              id: `c-${c.id}`,
              node: (
                <button type="button" onClick={() => onClassClick(c)} className="flex w-full items-center gap-1 truncate rounded-md px-1.5 py-px text-left text-[11px] leading-4 text-white" style={{ background: courseOf(c.course_id)?.color ?? '#888780' }}>
                  <span className="shrink-0 opacity-90">{c.start_time.slice(0, 5)}</span><span className="truncate">{courseOf(c.course_id)?.name ?? 'Class'}</span>
                </button>
              ),
            })),
            ...(itemsByDay[k] ?? []).map(it => ({ id: `${it.kind}-${it.id}`, node: <ItemChip item={it} course={courseOf(it.courseId)} compact onClick={() => onItemClick(it)} /> })),
          ]
          const hidden = entries.length - SHOWN
          const dots = [
            ...classes.filter(c => c.day_of_week === dow).map(c => courseOf(c.course_id)?.color ?? '#888780'),
            ...(itemsByDay[k] ?? []).map(it => courseOf(it.courseId)?.color ?? '#888780'),
          ]
          return (
            <div key={k} data-day={k} onClick={e => { if (!(e.target as HTMLElement).closest('button')) onDayClick(k) }}
              className={`min-w-0 space-y-0.5 overflow-hidden border-line p-1 max-md:cursor-pointer max-md:text-center ${i >= 7 ? 'border-t' : ''} ${i % 7 !== 0 ? 'border-l' : ''} ${outside ? 'bg-surface/50' : ''}`}>
              <button type="button" aria-label={longDay(k)} aria-current={k === todayKey ? 'date' : undefined} data-outside={outside ? 'true' : undefined} onClick={() => onDayClick(k)}
                className={`flex size-5 items-center justify-center rounded-full text-xs max-md:mx-auto max-md:size-7 max-md:text-sm hover:bg-surface ${k === todayKey ? 'bg-accent-solid font-semibold text-white hover:bg-accent-solid' : outside ? 'text-muted' : ''}`}>
                {Number(k.slice(8))}
              </button>
              <div aria-hidden className="flex flex-wrap justify-center gap-[3px] pt-0.5 md:hidden">
                {dots.slice(0, 4).map((c, n) => <span key={n} className="size-1.5 rounded-full" style={{ background: c }} />)}
                {dots.length > 4 && <span className="text-[9px] leading-none text-muted">+</span>}
              </div>
              <div className="space-y-0.5 max-md:sr-only">
              {entries.slice(0, SHOWN).map(e => <div key={e.id}>{e.node}</div>)}
              {hidden > 0 && (
                <button type="button" aria-label={`${hidden} more on ${longDay(k)}`} onClick={() => onDayClick(k)} className="px-1.5 text-[11px] leading-4 text-muted hover:text-fg">+{hidden} more</button>
              )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
