'use client'
import Link from 'next/link'
import { ListChecks, Mic, MessagesSquare, Upload, type LucideIcon } from 'lucide-react'
import { requestQuiz } from '@/lib/quiz/events'
import { requestUpload } from '@/lib/scan/events'

type Action = { label: string; hint: string; icon: LucideIcon; href?: string; onClick?: () => void }

// Home keeps these four on every screen. (Notes, decks and Scan are in the Create button, so they are not repeated here.)
const ACTIONS: Action[] = [
  { label: 'Take a quiz', hint: 'Quiz yourself on a note', icon: ListChecks, onClick: requestQuiz },
  { label: 'Record lecture', hint: 'Record and write it up', icon: Mic, href: '/lectures/record' },
  { label: 'Ask the tutor', hint: 'Get help with a topic', icon: MessagesSquare, href: '/tutor' },
  { label: 'Upload', hint: 'A PDF, slides or a file', icon: Upload, onClick: requestUpload },
]

// In the accent colour, in every look (quick-tile reads the student's own colour, which the quiet looks do not neutralise): the tiles are the one place on Home that is tinted with the student's own colour, so they stand out from the figures above
const tile = 'group flex items-center gap-2.5 quick-tile rounded-2xl border px-3 py-2.5 text-left transition hover:brightness-95 active:scale-[.98]'

// Compact tiles you can tap: a small coloured icon beside what it does, and a few words saying what it is for
export function HomeActions() {
  return (
    <section role="group" aria-label="Quick actions" className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
      {ACTIONS.map(a => {
        const inner = (
          <>
            <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-solid text-white"><a.icon size={15} aria-hidden /></span>
            <span className="min-w-0">
              <span className="block text-sm font-medium leading-tight text-accent">{a.label}</span>
              <span className="mt-0.5 block truncate text-xs leading-snug text-muted max-md:hidden">{a.hint}</span>
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
