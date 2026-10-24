'use client'
import Link from 'next/link'
import { requestQuiz } from '@/lib/quiz/events'

type Cell = { label: string; value: string; href?: string; onClick?: () => void; figure?: boolean }

// One strip of what to do next, split by hairlines: the cards due and the next class (said nowhere else on Home), then a quiz and the tutor
const cell = 'group flex min-w-0 flex-col gap-1 bg-raised px-4 py-3.5 text-left transition hover:bg-surface focus-visible:relative focus-visible:z-10'

export function HomeActions({ due, nextClass }: { due: number; nextClass: string | null }) {
  const cells: Cell[] = [
    due > 0 ? { label: 'Cards to review', value: `${due} due`, href: '/review', figure: true } : { label: 'Cards to review', value: 'All caught up', href: '/flashcards' },
    { label: 'Next class', value: nextClass ?? '—', href: '/planner', figure: !!nextClass },
    { label: 'Quiz yourself', value: 'Pick a note', onClick: requestQuiz },
    { label: 'Ask the tutor', value: 'Start a chat', href: '/tutor' },
  ]
  return (
    <section role="group" aria-label="Quick actions" className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-4">
      {cells.map(c => {
        const inner = (
          <>
            <span data-label className="text-[13px] text-muted">{c.label}</span>
            <span data-value className={`truncate text-[17px] font-medium leading-snug group-hover:underline group-hover:underline-offset-4 ${c.figure ? 'tabular-nums' : ''} ${c.value === '—' ? 'text-muted' : ''}`}>{c.value}</span>
          </>
        )
        return c.href
          ? <Link key={c.label} href={c.href} className={cell}>{inner}</Link>
          : <button key={c.label} type="button" className={cell} onClick={c.onClick}>{inner}</button>
      })}
    </section>
  )
}
