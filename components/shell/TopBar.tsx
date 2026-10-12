'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Flame, Layers, Pause, Play, Zap } from 'lucide-react'
import { MODE_LABEL, fmtClock, useFocus } from '@/components/providers/FocusProvider'
import { useXp } from '@/components/xp/useXp'
import { supabase } from '@/lib/supabase/client'
import { countDueCards } from '@/lib/data/cards'
import { remainingMs } from '@/lib/timer'

const PAGES: [string, string][] = [
  ['/home', 'Home'], ['/planner', 'Planner'], ['/focus', 'Focus'], ['/progress', 'Progress'], ['/notes', 'Notes'], ['/lectures', 'Lectures'],
  ['/flashcards', 'Flashcards'], ['/review', 'Review'], ['/tutor', 'Tutor'], ['/settings', 'Settings'], ['/plans', 'Plans'],
]
const pageName = (path: string) => PAGES.find(([p]) => path === p || path.startsWith(p + '/'))?.[1]
const chip = 'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium'

// A strip above every page (Vivid look): the focus timer, cards due, the streak and the level, so they are one glance away
export function TopBar() {
  const path = usePathname()
  const { timer, now, toggle } = useFocus()
  const { xp } = useXp()
  const [due, setDue] = useState<number | null>(null)

  // Counted again on each page, so it is right after a review session
  useEffect(() => {
    let live = true
    countDueCards(supabase(), new Date()).then(n => { if (live) setDue(n) }).catch(() => { if (live) setDue(null) })
    return () => { live = false }
  }, [path])

  const running = timer.startedAt !== null
  const label = timer.mode === 'focus' ? 'focus' : MODE_LABEL[timer.mode].toLowerCase()
  const clock = fmtClock(remainingMs(timer, now))
  const verb = running ? 'Pause' : timer.accumulatedMs > 0 ? 'Resume' : 'Start'
  const name = pageName(path)

  return (
    <header aria-label="Today at a glance" className="no-print sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-raised/95 px-4 py-2 backdrop-blur md:px-8">
      {name && <span data-page className="hidden text-base font-semibold sm:block">{name}</span>}
      <div className="ml-auto flex min-w-0 items-center gap-2 overflow-x-auto">
        <div className={`${chip} gap-2 bg-accent-soft py-1 pr-1 text-accent`}>
          <Link href="/focus" aria-label={`${MODE_LABEL[timer.mode] === 'Focus' ? 'Focus' : MODE_LABEL[timer.mode]} timer, ${clock} left`} className="font-mono tabular-nums">{clock}</Link>
          <button type="button" onClick={toggle} aria-label={`${verb} ${label} timer`} className="flex size-7 items-center justify-center rounded-full bg-accent-solid text-white">
            {running ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />}
          </button>
        </div>
        {due !== null && (
          <Link href={due > 0 ? '/review' : '/flashcards'} aria-label={due === 0 ? 'No cards due' : `${due} card${due === 1 ? '' : 's'} due`}
            className={`${chip} ${due > 0 ? 'tile-a text-fg' : 'bg-surface text-muted'}`}>
            <Layers size={15} aria-hidden /><span aria-hidden>{due === 0 ? 'No cards due' : `${due} due`}</span>
          </Link>
        )}
        {xp && xp.streak > 0 && <span className={`${chip} tile-c text-fg`}><Flame size={15} aria-hidden />{xp.streak}-day streak</span>}
        {xp && (
          <span className={`${chip} bg-surface text-fg`}>
            <Zap size={15} className="text-accent" aria-hidden />Level {xp.level.level}
            <span role="progressbar" aria-label={`Progress to level ${xp.level.level + 1}`} aria-valuenow={xp.level.into} aria-valuemin={0} aria-valuemax={xp.level.span} aria-valuetext={`${xp.level.into} of ${xp.level.span} XP`}
              className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-line sm:block">
              <span className="block h-full rounded-full bg-accent-solid" style={{ width: `${Math.round((xp.level.into / xp.level.span) * 100)}%` }} />
            </span>
          </span>
        )}
      </div>
    </header>
  )
}
