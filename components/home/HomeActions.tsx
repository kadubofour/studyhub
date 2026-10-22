'use client'
import Link from 'next/link'
import { ListChecks, MessagesSquare, type LucideIcon } from 'lucide-react'
import { requestQuiz } from '@/lib/quiz/events'

type Action = { label: string; hint: string; icon: LucideIcon; href?: string; onClick?: () => void }

// What is nowhere else on a phone. (Notes, decks, lectures, Upload and Scan are in the Create button, so they are not repeated here.)
const ACTIONS: Action[] = [
  { label: 'Take a quiz', hint: 'Quiz yourself on a note', icon: ListChecks, onClick: requestQuiz },
  { label: 'Ask the tutor', hint: 'Get help with a topic', icon: MessagesSquare, href: '/tutor' },
]

// In the accent colour, in every look: the tiles are the one place on Home that is tinted with the student's own colour, so they stand out from the figures above
const tile = 'group flex items-center gap-3 rounded-[20px] border border-accent/30 bg-accent-soft p-3 text-left transition hover:border-accent/60 hover:brightness-95 active:scale-[.98] md:flex-col md:items-start md:gap-2.5 md:p-3.5'

// Large tiles you can tap: a coloured icon, what it does, and a few words saying what it is for
export function HomeActions() {
  return (
    <section role="group" aria-label="Quick actions" className="grid grid-cols-2 gap-2.5 md:gap-3">
      {ACTIONS.map(a => {
        const inner = (
          <>
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-solid text-white md:size-9"><a.icon size={19} aria-hidden /></span>
            <span className="min-w-0">
              <span className="block text-sm font-medium leading-tight text-accent">{a.label}</span>
              <span className="mt-0.5 block text-xs leading-snug text-muted max-md:hidden">{a.hint}</span>
            </span>
          </>
        )
        return a.href
          ? <Link key={a.label} href={a.href} className={tile}>{inner}</Link>
          : <button key={a.label} type="button" className={tile} onClick={a.onClick}>{inner}</button>
      })}
    </section>
  )
}
