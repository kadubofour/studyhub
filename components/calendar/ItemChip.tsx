'use client'
import { BookOpen, Flag, GraduationCap } from 'lucide-react'
import { tint } from './TimeGrid'
import type { DayItem } from '@/lib/calendar/events'
import type { Course } from '@/lib/types'

// A deadline or study session, drawn like an all-day event on a phone calendar: a soft tint of the course colour with a colour bar. Tasks open for editing.
export function ItemChip({ item, course, onClick, compact = false }: { item: DayItem; course?: Course; onClick?: () => void; compact?: boolean }) {
  const exam = item.kind === 'task' && item.type === 'exam'
  const color = course?.color ?? '#888780'
  const cls = `flex w-full items-center gap-1 overflow-hidden truncate rounded-md border-l-[3px] px-1.5 text-left text-fg ${compact ? 'py-px text-[11px] leading-4' : 'h-6 text-xs'} ${exam ? 'font-semibold' : ''} ${item.kind === 'session' ? 'italic' : ''}`
  const style = { borderLeftColor: color, background: tint(color, 22) }
  const Icon = exam ? GraduationCap : item.kind === 'session' ? BookOpen : Flag
  const inner = (
    <>
      <Icon size={11} className="shrink-0" aria-hidden />
      {item.time && <span className="shrink-0 opacity-80">{item.time}</span>}
      <span className="truncate">{item.title}</span>
      {item.kind === 'task' && item.priority === 'high' && <span className="shrink-0 text-danger"><Flag size={11} className="fill-current" aria-hidden /><span className="sr-only">High priority</span></span>}
    </>
  )
  if (item.kind === 'task' && onClick) {
    return <button type="button" onClick={onClick} data-exam={exam ? 'true' : undefined} className={`${cls} hover:brightness-95`} style={style}>{inner}</button>
  }
  return <div className={cls} style={style} data-exam={exam ? 'true' : undefined}>{inner}</div>
}
