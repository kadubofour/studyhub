'use client'
import { BookOpen, Flag, GraduationCap } from 'lucide-react'
import type { DayItem } from '@/lib/calendar/events'
import type { Course } from '@/lib/types'

// A deadline or study session in a day, drawn as before: a dashed outline in the course colour with a flag. Tasks open for editing.
export function ItemChip({ item, course, onClick, compact = false }: { item: DayItem; course?: Course; onClick?: () => void; compact?: boolean }) {
  const exam = item.kind === 'task' && item.type === 'exam'
  const cls = `flex w-full items-center gap-1 truncate rounded border border-dashed bg-bg px-1.5 text-left ${compact ? 'py-px text-[11px]' : 'py-0.5 text-xs'} ${exam ? 'font-semibold' : ''} ${item.kind === 'session' ? 'text-muted' : ''}`
  const style = { borderColor: course?.color ?? 'var(--line)' }
  const Icon = exam ? GraduationCap : item.kind === 'session' ? BookOpen : Flag
  const inner = (
    <>
      <Icon size={11} className="shrink-0" aria-hidden />
      <span className="truncate">{item.title}</span>
      {item.kind === 'task' && item.priority === 'high' && <span className="shrink-0 text-danger"><Flag size={11} className="fill-current" aria-hidden /><span className="sr-only">High priority</span></span>}
    </>
  )
  if (item.kind === 'task' && onClick) {
    return <button type="button" onClick={onClick} data-exam={exam ? 'true' : undefined} className={`${cls} hover:bg-surface`} style={style}>{inner}</button>
  }
  return <div className={cls} style={style} data-exam={exam ? 'true' : undefined}>{inner}</div>
}
