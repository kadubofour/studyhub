'use client'
import { BookOpen, LayoutGrid } from 'lucide-react'
import { focusRadio, radioKeyTarget } from '@/lib/ui/radioKeys'

export type CourseOption = { value: string; label: string; color?: string; count: number }

// Which course's chats the list shows: a row of tabs on the list's own heading line, each with how many chats it holds, the open one underlined.
// Each has a small icon: the course's own colour on a book, a grid for all of them. It reads as a filter of the list below it, not as one more way to start a chat. A group of radio buttons, so the arrow keys move along it.
// On a narrow screen it scrolls sideways.
export function CourseFilter({ label, value, options, onChange, className = '' }: {
  label: string; value: string; options: CourseOption[]; onChange: (v: string) => void; className?: string
}) {
  const current = Math.max(0, options.findIndex(o => o.value === value))
  return (
    <div role="radiogroup" aria-label={label} className={`no-scrollbar -mx-1 flex gap-1 overflow-x-auto border-b border-line px-1 ${className}`}>
      {options.map((o, i) => {
        const on = i === current
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} onClick={() => onChange(o.value)}
            onKeyDown={e => {
              const to = radioKeyTarget(e.key, i, options.length)
              if (to === null) return
              e.preventDefault(); onChange(options[to].value); focusRadio(e.currentTarget, to)
            }}
            className={`choice relative -mb-px inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-[14px] outline-none transition focus-visible:bg-surface pointer-coarse:py-3 ${on ? 'border-[var(--accent-solid)] font-semibold text-fg' : 'border-transparent text-muted hover:text-fg'}`}>
            {/* a course is a book in its own colour; All courses is a grid of them */}
            {o.value === '' ? <LayoutGrid size={15} aria-hidden className="shrink-0" /> : <BookOpen size={15} aria-hidden className="shrink-0" style={o.color ? { color: o.color } : undefined} />}
            {o.label}
            <span aria-hidden className={`text-xs tabular-nums ${on ? 'text-muted' : 'text-muted/70'}`}>{o.count}</span>
          </button>
        )
      })}
    </div>
  )
}
