'use client'
import Link from 'next/link'
import { CourseTag } from '@/components/ui/CourseTag'
import type { SessionView } from '@/lib/plan/load'
import type { Course } from '@/lib/types'

export const KIND_LABEL = { warmup: 'Warm-up', learn: 'Learn', revise: 'Revise' } as const

// One planned study session, as a tick-off row like a task
export function SessionRow({ s, course, done, onToggle, onWarmup, warmingUp }: {
  s: SessionView; course?: Course; done: boolean; onToggle: () => void; onWarmup?: () => void; warmingUp?: boolean
}) {
  const label = `${KIND_LABEL[s.kind]}: ${s.topicName}`
  return (
    <div className="mb-1.5 flex items-center gap-3 rounded-r-xl border border-l-4 border-line bg-raised py-2 pl-3 pr-2"
      style={{ borderLeftColor: course?.color ?? 'var(--line)' }}>
      <input type="checkbox" checked={done} onChange={onToggle} aria-label={`Mark ${label} done`} className="size-4 shrink-0 accent-[var(--accent-solid)]" />
      <div className="min-w-0 flex-1">
        <div className={`truncate ${done ? 'text-muted line-through' : ''}`}>{label}</div>
        <div className="mt-0.5 flex items-center gap-3 text-xs text-muted"><CourseTag course={course} /><span>{s.minutes} min</span></div>
      </div>
      {s.kind === 'warmup' && s.noteId && onWarmup
        ? <button type="button" className="btn" disabled={warmingUp} onClick={onWarmup}>{warmingUp ? 'Making quiz…' : 'Start warm-up'}</button>
        : <Link className="btn-ghost text-accent" href={s.noteId ? `/notes/${s.noteId}` : '/progress'}>Open</Link>}
    </div>
  )
}
