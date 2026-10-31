'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Check, Circle, CircleCheck, MoreHorizontal, Search, type LucideIcon } from 'lucide-react'
import { ContextMenu, type MenuEntry } from '@/components/ui/ContextMenu'

// The parts of a list page on a phone, as notes apps have it (the Notes list first, then Flashcards, Lectures, the Library, Quiz and
// the Tutor): a big title with a ⋯ menu, a search field, the items as compact rows in rounded groups, each with a small drawing of
// what it is, its date and one line about it, a count at the end, and a round button for a new one at the bottom right, where the
// thumb is. A computer keeps each page's tiles.

// An empty space the size of an icon, so a menu's unchosen options line up with the chosen one's tick
export const NoIcon = (({ size = 15 }: { size?: number | string }) => <span aria-hidden className="inline-block" style={{ width: size, height: size }} />) as unknown as LucideIcon
/** One choice in a ⋯ menu, ticked when it is the current one */
export const tick = (label: string, on: boolean, onSelect: () => void): MenuEntry => ({ label, icon: on ? Check : NoIcon, onSelect })

/** The big title, with the page's ⋯ menu (or Done while selecting) */
export function PhoneTitle({ title, menuLabel, menu, selecting = false, onDone }: {
  title: string; menuLabel: string; menu: MenuEntry[]; selecting?: boolean; onDone?: () => void
}) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h1 className="font-display text-[2rem] font-bold leading-tight tracking-tight">{title}</h1>
      {selecting
        ? <button type="button" className="text-[15px] font-semibold text-accent" onClick={onDone}>Done</button>
        : <button type="button" aria-label={menuLabel} aria-haspopup="menu" className="grid size-10 place-items-center rounded-full text-accent active:bg-surface"
            onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setAt({ x: r.right, y: r.bottom + 4 }) }}><MoreHorizontal size={22} aria-hidden /></button>}
      {at && <ContextMenu x={at.x} y={at.y} label={menuLabel} items={menu} onClose={() => setAt(null)} />}
    </div>
  )
}

/** The search field under the title */
export function PhoneSearch({ label, value, onChange, className = 'mb-5' }: { label: string; value: string; onChange: (q: string) => void; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
      <input type="search" className="h-10 w-full rounded-xl bg-surface pl-10 pr-3 text-[16px] outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
        placeholder="Search" aria-label={label} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  )
}

/** A small capitalised heading over a group */
export const PhoneHeading = ({ id, children }: { id?: string; children: React.ReactNode }) =>
  <h2 id={id} className="mb-1.5 px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">{children}</h2>

/** A group of rows on one rounded card, under its heading (a list with no heading is named by `name`) */
export function PhoneGroup({ label, name, children }: { label?: string; name?: string; children: React.ReactNode }) {
  return (
    <section aria-label={label || name} className="mb-6">
      {label && <PhoneHeading>{label}</PhoneHeading>}
      <ul aria-label={label || name} className="divide-y divide-line overflow-hidden rounded-2xl bg-raised">{children}</ul>
    </section>
  )
}

/** One item: its drawing, its title, and a line with its date (darker) then something about it. While selecting, a tap ticks it. */
export function PhoneRow({ href, onClick, mark, title, date, line, select, onContextMenu }: {
  href?: string; onClick?: () => void; mark: React.ReactNode; title: string; date?: string; line?: React.ReactNode
  select?: { on: boolean; onToggle: () => void }
  onContextMenu?: (e: React.MouseEvent) => void
}) {
  const body = (
    <>
      {select && (select.on ? <CircleCheck size={22} aria-hidden className="shrink-0 text-accent" /> : <Circle size={22} aria-hidden className="shrink-0 text-muted" />)}
      {mark}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-semibold">{title || 'Untitled'}</span>
        {(date || line) && <span className="block truncate text-[14px] text-muted">{date && <span className="text-fg/70">{date}</span>}{date && line ? '  ' : ''}{line}</span>}
      </span>
    </>
  )
  const row = 'flex min-h-[3.75rem] w-full items-center gap-3 px-4 py-2.5 text-left active:bg-surface'
  return (
    <li>
      {select
        ? <button type="button" role="checkbox" aria-checked={select.on} aria-label={title || 'Untitled'} className={row} onClick={select.onToggle}>{body}</button>
        : href ? <Link href={href} className={row} onContextMenu={onContextMenu}>{body}</Link>
        : <button type="button" className={row} onClick={onClick} onContextMenu={onContextMenu}>{body}</button>}
    </li>
  )
}

/** "12 decks", small and centred after the groups */
export const PhoneCount = ({ n, one, many }: { n: number; one: string; many: string }) =>
  n > 0 ? <p className="text-center text-[13px] text-muted">{n} {n === 1 ? one : many}</p> : null

/** What the page shows with nothing in it, or nothing matching */
export const PhoneEmpty = ({ children }: { children: React.ReactNode }) => <p className="py-10 text-center text-[15px] text-muted">{children}</p>

/** The round button for a new one, at the bottom right above the dock */
export function ComposeButton({ label, icon: Icon, onClick, href }: { label: string; icon: LucideIcon; onClick?: () => void; href?: string }) {
  const cls = 'fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-5 z-30 grid size-14 place-items-center rounded-full bg-accent-solid text-white shadow-[0_10px_24px_-8px_rgb(0_0_0/0.45)] transition active:scale-95'
  return href
    ? <Link href={href} aria-label={label} className={cls}><Icon size={24} aria-hidden /></Link>
    : <button type="button" aria-label={label} onClick={onClick} className={cls}><Icon size={24} aria-hidden /></button>
}

// Each kind's small drawing for its rows, from the drawings the computer's tiles have in their corner, in the course's colour
const tint = (color: string, n: number, base = 'var(--raised)') => `color-mix(in srgb, ${color} ${n}%, ${base})`
type MarkProps = { color?: string }
/** A note: ruled sheets */
export function SheetMark({ color = 'var(--accent-solid)' }: MarkProps) {
  return (
    <span aria-hidden data-motif="sheets" className="relative h-10 w-8 shrink-0">
      <span className="absolute inset-0 rotate-[8deg] rounded-[5px] opacity-25" style={{ background: color }} />
      <span className="absolute inset-0 -rotate-[3deg] rounded-[5px]"
        style={{ background: `repeating-linear-gradient(to bottom, transparent 0 6px, color-mix(in srgb, ${color} 55%, transparent) 6px 7px), ${tint(color, 22)}` }} />
    </span>
  )
}
/** A deck: index cards fanned out */
export function CardsMark({ color = 'var(--accent-solid)' }: MarkProps) {
  return (
    <span aria-hidden data-motif="cards" className="relative h-10 w-9 shrink-0">
      <span className="absolute inset-x-0.5 inset-y-1.5 rotate-[14deg] rounded-[6px] opacity-25" style={{ background: color }} />
      <span className="absolute inset-x-0.5 inset-y-1.5 rotate-[4deg] rounded-[6px] opacity-45" style={{ background: color }} />
      <span className="absolute inset-x-0.5 inset-y-1.5 -rotate-[5deg] rounded-[6px] border" style={{ background: tint(color, 18), borderColor: tint(color, 45) }} />
    </span>
  )
}
const BARS = [40, 70, 35, 85, 55, 75, 40]
/** A lecture: a sound strip */
export function StripMark({ color = 'var(--accent-solid)' }: MarkProps) {
  return (
    <span aria-hidden data-motif="strip" className="flex h-10 w-9 shrink-0 items-center justify-center gap-[2.5px] rounded-[8px]" style={{ background: tint(color, 16) }}>
      {BARS.map((h, i) => <span key={i} className="w-[2.5px] rounded-full" style={{ height: `${h * 0.28}px`, background: color }} />)}
    </span>
  )
}
/** A quiz: a ticked list */
export function ChecklistMark({ color = 'var(--accent-solid)' }: MarkProps) {
  return (
    <span aria-hidden data-motif="checklist" className="flex h-10 w-9 shrink-0 flex-col justify-center gap-[5px] rounded-[8px] px-[6px]" style={{ background: tint(color, 16) }}>
      {[1, 1, 0].map((done, i) => (
        <span key={i} className="flex items-center gap-[3px]">
          <span className="grid size-[7px] place-items-center rounded-[2px] border" style={{ borderColor: color, background: done ? color : 'transparent' }} />
          <span className="h-[2.5px] flex-1 rounded-full" style={{ background: tint(color, 45, 'transparent') }} />
        </span>
      ))}
    </span>
  )
}
/** A tutor chat: two speech bubbles */
export function ChatMark({ color = 'var(--accent-solid)' }: MarkProps) {
  return (
    <span aria-hidden data-motif="chat" className="relative h-10 w-9 shrink-0">
      <span className="absolute left-0 top-1.5 h-4 w-6 rounded-[6px] rounded-bl-[2px]" style={{ background: tint(color, 30) }} />
      <span className="absolute bottom-1.5 right-0 h-4 w-6 rounded-[6px] rounded-br-[2px]" style={{ background: color }} />
    </span>
  )
}
/** A kept file: a page with its corner folded */
export function FileMark({ color = 'var(--accent-solid)' }: MarkProps) {
  return (
    <span aria-hidden data-motif="file" className="relative h-10 w-8 shrink-0 rounded-[5px] [clip-path:polygon(0_0,70%_0,100%_26%,100%_100%,0_100%)]" style={{ background: tint(color, 22) }}>
      <span className="absolute right-0 top-0 size-[30%] rounded-bl-[3px]" style={{ background: tint(color, 50) }} />
    </span>
  )
}
