'use client'
import { Flag } from 'lucide-react'
import { weekdayOfKey } from '@/lib/dates'
import type { ClassSlot, Course } from '@/lib/types'

const START_H = 7, END_H = 21, PX_PER_H = 40
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function WeekGrid({ weekKeys, todayKey, classes, courses, deadlines, onClassClick, onEmptyClick }: {
  weekKeys: string[]; todayKey: string; classes: ClassSlot[]; courses: Course[]
  deadlines: { id: string; title: string; dayKey: string; color?: string }[]
  onClassClick?: (c: ClassSlot) => void; onEmptyClick?: (dayOfWeek: number, hour: number) => void
}) {
  const height = (END_H - START_H) * PX_PER_H
  const courseOf = (id: string) => courses.find(c => c.id === id)
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[640px] gap-1" style={{ gridTemplateColumns: '40px repeat(7, minmax(0, 1fr))' }}>
        <div />
        {weekKeys.map(k => (
          <div key={k} className={`text-center text-xs font-medium ${k === todayKey ? 'text-accent' : ''}`}>
            {DAY_NAMES[weekdayOfKey(k)]} {Number(k.slice(8))}
          </div>
        ))}
        <div className="relative" style={{ height }}>
          {Array.from({ length: END_H - START_H + 1 }, (_, i) => START_H + i).filter(h => h % 2 === 0).map(h => (
            <div key={h} className="absolute text-[11px] text-muted" style={{ top: (h - START_H) * PX_PER_H - 6 }}>{h}:00</div>
          ))}
        </div>
        {weekKeys.map(k => {
          const dow = weekdayOfKey(k)
          return (
            <div key={k} className="relative rounded-lg bg-surface" style={{ height }}
              onClick={e => {
                if (!onEmptyClick || e.target !== e.currentTarget) return
                const y = e.nativeEvent.offsetY
                onEmptyClick(dow, Math.min(END_H - 1, START_H + Math.floor(y / PX_PER_H)))
              }}>
              {deadlines.filter(d => d.dayKey === k).map((d, i) => (
                <div key={d.id} className="absolute inset-x-0.5 truncate rounded border border-dashed bg-bg px-1 text-[11px]"
                  style={{ top: 2 + i * 20, borderColor: d.color ?? 'var(--line)' }}>
                  <Flag size={10} className="mr-0.5 inline" aria-hidden />{d.title}
                </div>
              ))}
              {classes.filter(c => c.day_of_week === dow).map(c => {
                const top = ((toMin(c.start_time) - START_H * 60) / 60) * PX_PER_H
                const h = ((toMin(c.end_time) - toMin(c.start_time)) / 60) * PX_PER_H
                const course = courseOf(c.course_id)
                return (
                  <button key={c.id} type="button" onClick={() => onClassClick?.(c)} disabled={!onClassClick}
                    className="absolute inset-x-0.5 overflow-hidden rounded-md px-1.5 py-0.5 text-left text-[11px] leading-tight text-white"
                    style={{ top: Math.max(0, top), height: Math.max(18, h - 2), background: course?.color ?? '#888780' }}>
                    {course?.name}<br /><span className="opacity-90">{c.kind}{c.location ? ` · ${c.location}` : ''}</span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
