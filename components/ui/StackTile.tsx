'use client'
import Link from 'next/link'
import { Check, MoreHorizontal } from 'lucide-react'

// The grid tile for a student's things, drawn after the deck tile: the item's object sketched in the corner in its course's colour
// (index cards for a deck, ruled sheets for a note, a recording strip for a lecture), the title, the course, one big detail with
// its label, and a smaller detail at the side.
export type Motif = 'cards' | 'sheets' | 'strip'

const BARS = [38, 62, 30, 80, 52, 70, 34, 58, 44] // the strip's bar heights, fixed so server and browser draw the same

function MotifArt({ motif, color }: { motif: Motif; color: string }) {
  if (motif === 'cards') return (
    <span data-motif="cards" aria-hidden="true">
      <span className="absolute -right-3 -top-3 size-16 rotate-12 rounded-xl opacity-15" style={{ background: color }} />
      <span className="absolute -right-1 top-1 size-12 rotate-6 rounded-xl opacity-25" style={{ background: color }} />
    </span>
  )
  if (motif === 'sheets') return (
    <span data-motif="sheets" aria-hidden="true">
      <span className="absolute -right-2 -top-4 h-20 w-14 rotate-12 rounded-md opacity-15" style={{ background: color }} />
      <span className="absolute right-1 -top-1 h-16 w-12 rotate-[5deg] rounded-md opacity-25"
        style={{ background: `repeating-linear-gradient(to bottom, transparent 0 7px, color-mix(in srgb, ${color} 55%, transparent) 7px 8px), color-mix(in srgb, ${color} 45%, transparent)` }} />
    </span>
  )
  return (
    <span data-motif="strip" aria-hidden="true" className="absolute right-3 top-3 flex h-10 items-end gap-[3px] opacity-30">
      {BARS.map((h, i) => <span key={i} className="w-[3px] rounded-full" style={{ height: `${h}%`, background: color }} />)}
    </span>
  )
}

export function StackTile({ motif, color = 'var(--accent-solid)', title, href, tag, big, bigColor, bigLabel, side, select, onMenu, onContextMenu }: {
  motif: Motif; color?: string; title: string; href: string
  /** The course tag under the title */
  tag?: React.ReactNode
  big: React.ReactNode; bigLabel: React.ReactNode
  /** The big detail in the course colour (a deck's cards due) */
  bigColor?: string
  side?: React.ReactNode
  select?: { on: boolean; onToggle: () => void }
  onMenu?: (e: React.MouseEvent) => void
  onContextMenu?: (e: React.MouseEvent) => void
}) {
  const name = title || 'Untitled'
  const on = !!select?.on
  const body = (
    <>
      <MotifArt motif={motif} color={color} />
      <span className="relative block">
        <span className="flex items-start gap-2">
          {select && <span aria-hidden className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border ${on ? 'border-transparent bg-[var(--accent-solid)] text-white' : 'border-line bg-bg'}`}>{on && <Check size={12} />}</span>}
          <span data-title className="font-display line-clamp-2 pr-12 text-[17px] font-semibold leading-snug">{name}</span>
        </span>
        {tag && <span className="mt-1 block">{tag}</span>}
        <span className="mt-5 flex items-end justify-between gap-3">
          <span className="min-w-0">
            <span className="font-display block text-2xl font-semibold leading-none tracking-tight" style={bigColor ? { color: bigColor } : undefined}>{big}</span>
            <span className="mt-1 block text-xs text-muted">{bigLabel}</span>
          </span>
          {side && <span className="min-w-0 truncate text-right text-xs text-muted">{side}</span>}
        </span>
      </span>
    </>
  )
  const cls = `tile group relative block h-full w-full overflow-hidden text-left transition hover:-translate-y-0.5 ${on ? 'ring-2 ring-accent' : ''}`
  return (
    <div role="listitem" className="group relative">
      {select
        ? <button type="button" role="checkbox" aria-checked={on} aria-label={`Select ${name}`} className={cls} onClick={select.onToggle}>{body}</button>
        : <Link href={href} className={cls} onContextMenu={onContextMenu}>{body}</Link>}
      {onMenu && !select && (
        <button type="button" aria-label={`More actions for ${name}`} aria-haspopup="menu" onClick={onMenu}
          className="absolute right-2 top-2 rounded-lg bg-raised/80 p-1 text-muted opacity-0 transition hover:bg-surface hover:text-fg focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:p-2.5 [@media(pointer:coarse)]:opacity-100">
          <MoreHorizontal size={16} aria-hidden />
        </button>
      )}
    </div>
  )
}
