'use client'
import { STARTER_ICONS } from '@/components/tutor/starterIcons'
import { STARTERS, type Starter } from '@/lib/tutor/starters'

// The ways to start a chat, as one slim row of small chips: an icon and a name (what each does is its tooltip).
// On a phone the row scrolls sideways rather than taking a second line; a computer lets it wrap.
export function StarterChips({ label, onPick, className = '' }: { label: string; onPick: (s: Starter) => void; className?: string }) {
  return (
    <ul aria-label={label} className={`no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 ${className}`}>
      {STARTERS.map(s => {
        const Icon = STARTER_ICONS[s.id as keyof typeof STARTER_ICONS]
        return (
          <li key={s.id} className="shrink-0">
            <button type="button" title={s.hint} onClick={() => onPick(s)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-raised px-3.5 text-[14px] font-medium transition hover:bg-surface active:bg-surface pointer-coarse:h-10">
              <Icon size={15} aria-hidden className="shrink-0 text-accent" />{s.title}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
