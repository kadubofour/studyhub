'use client'
import Link from 'next/link'
import { Check, MoreHorizontal, type LucideIcon } from 'lucide-react'
import type { Layout } from '@/lib/ui/listView'

// One look for an item in any list of the student's things (notes, decks, lectures), in each of the three layouts:
// grid (a tile), list (a row) and icons (a big icon with the name under it, like files on a desktop).

const LIST_CLASS: Record<Layout, string> = {
  grid: 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3',
  list: 'flex flex-col gap-2',
  icons: 'grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8',
}

export function ItemList({ label, layout, children }: { label: string; layout: Layout; children: React.ReactNode }) {
  return <div role="list" aria-label={label} data-layout={layout} className={LIST_CLASS[layout]}>{children}</div>
}

// The item's icon on a soft square of its course's colour (the accent when it has none)
function IconBox({ icon: Icon, color, size, badge }: { icon: LucideIcon; color: string; size: 'sm' | 'md' | 'lg'; badge?: string | number }) {
  const box = { sm: 'size-8 rounded-lg', md: 'size-10 rounded-xl', lg: 'size-16 rounded-2xl' }[size]
  return (
    <span data-icon aria-hidden className={`relative grid shrink-0 place-items-center ${box}`} style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}>
      <Icon size={size === 'lg' ? 28 : size === 'md' ? 18 : 15} />
      {badge !== undefined && badge !== 0 && (
        <span data-badge className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-[var(--accent-solid)] px-1.5 text-center text-[11px] font-semibold leading-5 text-white">{badge}</span>
      )}
    </span>
  )
}

export function ItemTile({ layout, icon, color = 'var(--accent-solid)', title, href, subtitle, meta, aside, badge, select, onMenu, onContextMenu }: {
  layout: Layout; icon: LucideIcon
  /** The course's colour, for the icon and the edge of the tile */
  color?: string
  title: string; href: string
  /** A short second line: the notebook, the course */
  subtitle?: React.ReactNode
  /** Tags at the bottom left (course), and a detail at the right (when, how many) */
  meta?: React.ReactNode; aside?: React.ReactNode
  /** A count shown on the icon, such as cards due */
  badge?: string | number
  /** While selecting, the tile ticks instead of opening */
  select?: { on: boolean; onToggle: () => void }
  onMenu?: (e: React.MouseEvent) => void
  onContextMenu?: (e: React.MouseEvent) => void
}) {
  const name = title || 'Untitled'
  const on = !!select?.on
  const tick = select && (
    <span aria-hidden className={`grid size-5 shrink-0 place-items-center rounded-full border ${on ? 'border-transparent bg-[var(--accent-solid)] text-white' : 'border-line bg-bg'}`}>{on && <Check size={12} />}</span>
  )
  const titleEl = <span data-title className={layout === 'list' ? 'min-w-0 flex-1 truncate font-medium' : layout === 'icons' ? 'line-clamp-2 text-sm' : 'line-clamp-2 font-medium'}>{name}</span>

  const body = layout === 'icons' ? (
    <>
      {select && <span className="absolute left-1.5 top-1.5">{tick}</span>}
      <IconBox icon={icon} color={color} size="lg" badge={badge} />
      {titleEl}
      {/* the details are not shown in this layout, but they are still read out */}
      <span className="sr-only">
        {[subtitle, meta, aside].filter(Boolean).map((part, i) => <span key={i}>{i > 0 && <span>, </span>}<span>{part}</span></span>)}
      </span>
    </>
  ) : layout === 'list' ? (
    <>
      {tick}
      <IconBox icon={icon} color={color} size="sm" badge={badge} />
      {titleEl}
      {subtitle && <span className="min-w-0 truncate text-xs text-muted max-sm:hidden">{subtitle}</span>}
      {meta}
      {aside && <span className="shrink-0 text-xs text-muted">{aside}</span>}
    </>
  ) : (
    <>
      <span className="flex items-start gap-3">
        <IconBox icon={icon} color={color} size="md" />
        <span className="min-w-0 flex-1">
          {titleEl}
          {subtitle && <span className="mt-0.5 block truncate text-xs text-muted">{subtitle}</span>}
        </span>
        {tick}
      </span>
      {(meta || aside) && (
        <span className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">{meta}</span>
          {aside && <span className="ml-auto shrink-0 text-xs text-muted">{aside}</span>}
        </span>
      )}
    </>
  )

  const ring = on ? 'ring-2 ring-accent' : ''
  const cls = layout === 'icons'
    ? `relative flex h-full w-full flex-col items-center gap-2 rounded-xl p-2 pt-3 text-center transition hover:bg-surface ${ring}`
    : layout === 'list'
      ? `tile flex w-full items-center gap-3 border-l-4 !py-2.5 text-left transition hover:border-accent ${onMenu ? 'pr-11' : ''} ${ring}`
      : `tile flex h-full w-full flex-col gap-3 border-t-4 text-left transition hover:-translate-y-0.5 ${onMenu ? 'pr-10' : ''} ${ring}`
  const edge = layout === 'list' ? { borderLeftColor: color } : layout === 'grid' ? { borderTopColor: color } : undefined

  return (
    <div role="listitem" className="group relative">
      {select
        ? <button type="button" role="checkbox" aria-checked={on} aria-label={`Select ${name}`} className={cls} style={edge} onClick={select.onToggle}>{body}</button>
        : <Link href={href} className={cls} style={edge} title={layout === 'icons' ? name : undefined} onContextMenu={onContextMenu}>{body}</Link>}
      {onMenu && !select && (
        <button type="button" aria-label={`More actions for ${name}`} aria-haspopup="menu" onClick={onMenu}
          className={`absolute rounded-lg p-1 text-muted opacity-0 transition hover:bg-surface hover:text-fg focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:p-2.5 [@media(pointer:coarse)]:opacity-100 ${layout === 'list' ? 'right-2 top-1/2 -translate-y-1/2' : layout === 'icons' ? 'right-0.5 top-0.5' : 'right-2 top-3'}`}>
          <MoreHorizontal size={16} aria-hidden />
        </button>
      )}
    </div>
  )
}
