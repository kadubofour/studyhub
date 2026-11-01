'use client'
import Link from 'next/link'
import { BookOpen, RotateCw, Zap, type LucideIcon } from 'lucide-react'
import type { SessionView } from '@/lib/plan/load'
import type { Course } from '@/lib/types'

export const KIND_LABEL = { warmup: 'Warm-up', learn: 'Learn', revise: 'Revise' } as const
export const KIND_ICON: Record<keyof typeof KIND_LABEL, LucideIcon> = { warmup: Zap, learn: BookOpen, revise: RotateCw }

// One planned study session, as a tick-off row: its kind drawn in the course's colour, what to do, how long, and the way in
export function SessionRow({ s, course, done, onToggle, onWarmup, warmingUp, showCourse = true }: {
  s: SessionView; course?: Course; showCourse?: boolean; done: boolean; onToggle: () => void; onWarmup?: () => void; warmingUp?: boolean
}) {
  const label = `${KIND_LABEL[s.kind]}: ${s.topicName}`
  const Icon = KIND_ICON[s.kind]
  const color = course?.color ?? 'var(--accent-solid)'
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <input type="checkbox" checked={done} onChange={onToggle} aria-label={`Mark ${label} done`} className="size-5 shrink-0 rounded-full accent-[var(--accent-solid)] pointer-coarse:box-content pointer-coarse:-m-2 pointer-coarse:p-2" />
      <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}><Icon size={17} /></span>
      <div className="min-w-0 flex-1">
        <div className={`truncate text-[15px] font-medium ${done ? 'text-muted line-through' : ''}`}>{label}</div>
        <div className="text-[13px] text-muted">{showCourse && course && <><span>{course.name}</span> · </>}<span>{s.minutes} min</span></div>
      </div>
      {s.kind === 'warmup' && s.noteId && onWarmup
        ? <button type="button" className="btn !rounded-full !px-3.5 text-sm" disabled={warmingUp} onClick={onWarmup}>{warmingUp ? 'Making quiz…' : 'Start warm-up'}</button>
        : <Link className="rounded-full px-3 py-1.5 text-sm font-medium text-accent active:bg-surface" href={s.noteId ? `/notes/${s.noteId}` : '/progress'}>Open</Link>}
    </div>
  )
}
