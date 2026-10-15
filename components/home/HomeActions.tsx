'use client'
import Link from 'next/link'
import { ListChecks, Mic, MessagesSquare, Upload, type LucideIcon } from 'lucide-react'
import { requestQuiz } from '@/lib/quiz/events'
import { requestUpload } from '@/lib/scan/events'

type Action = { label: string; hint: string; icon: LucideIcon; color: string; href?: string; onClick?: () => void }

// What has no tab of its own: Home keeps these four. (Notes, decks and Scan are in the bar, so they are not repeated here.)
const ACTIONS: Action[] = [
  { label: 'Take a quiz', hint: 'Quiz yourself on a note', icon: ListChecks, color: '#7c3aed', onClick: requestQuiz },
  { label: 'Record lecture', hint: 'Record and write it up', icon: Mic, color: '#dc2626', href: '/lectures/record' },
  { label: 'Ask the tutor', hint: 'Get help with a topic', icon: MessagesSquare, color: '#0d9488', href: '/tutor' },
  { label: 'Upload', hint: 'A PDF, slides or a file', icon: Upload, color: '#d97706', onClick: requestUpload },
]

const tile = 'group flex items-center gap-3 rounded-[20px] bg-[color-mix(in_srgb,var(--c)_14%,var(--raised))] p-3 text-left transition hover:brightness-95 active:scale-[.98] md:flex-col md:items-start md:gap-2.5 md:p-3.5'

// Four large tiles you can tap: a coloured icon, what it does, and a few words saying what it is for
export function HomeActions() {
  return (
    <section role="group" aria-label="Quick actions" className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
      {ACTIONS.map(a => {
        const inner = (
          <>
            <span aria-hidden data-tint-icon className="grid size-10 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--c)_26%,var(--raised))] md:size-9"><a.icon size={19} aria-hidden /></span>
            <span className="min-w-0">
              <span className="block text-sm font-medium leading-tight">{a.label}</span>
              <span className="mt-0.5 block text-xs leading-snug text-muted max-md:hidden">{a.hint}</span>
            </span>
          </>
        )
        const style = { '--c': a.color } as React.CSSProperties
        return a.href
          ? <Link key={a.label} href={a.href} data-tint className={tile} style={style}>{inner}</Link>
          : <button key={a.label} type="button" data-tint className={tile} style={style} onClick={a.onClick}>{inner}</button>
      })}
    </section>
  )
}
