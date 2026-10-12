import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

// Four card styles, each for where it fits. The colour comes in as --c, so one class does the tinting in every look and theme.
const wrap = (href: string | undefined, className: string, style: React.CSSProperties, children: React.ReactNode) =>
  href ? <Link href={href} className={className} style={style}>{children}</Link> : <div className={className} style={style}>{children}</div>
const colorVar = (color: string) => ({ '--c': color }) as React.CSSProperties

// A. Tinted tile: a soft wash of its own colour, an icon in a circle, a big figure. For the numbers on Home.
export function TintTile({ color, icon: Icon, label, children, href, className = '' }: {
  color: string; icon: LucideIcon; label: string; children: React.ReactNode; href?: string; className?: string
}) {
  return wrap(href, `block rounded-[20px] bg-[color-mix(in_srgb,var(--c)_16%,var(--raised))] px-4 py-3.5 transition hover:brightness-95 ${className}`, colorVar(color), (
    <>
      <span aria-hidden="true" className="mb-2.5 flex size-8 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--c)_28%,var(--raised))]"><Icon size={17} aria-hidden="true" /></span>
      <div className="text-xs text-fg">{label}</div>
      <div className="mt-0.5 text-3xl font-medium leading-tight">{children}</div>
    </>
  ))
}

// B. Index card: a hairline border, a coloured rule across the top, the figure set in the serif voice. For decks.
export function IndexCard({ color, title, eyebrow, value, sub, href, valueColor }: {
  color: string; title: string; eyebrow?: React.ReactNode; value: React.ReactNode; sub?: React.ReactNode; href?: string; valueColor?: boolean
}) {
  return wrap(href, 'block rounded-md border border-line border-t-4 border-t-[var(--c)] bg-raised px-3.5 py-3 transition hover:bg-surface', colorVar(color), (
    <>
      <div className="font-medium">{title}</div>
      {eyebrow && <div className="mt-0.5">{eyebrow}</div>}
      <div className="mt-3 text-3xl leading-none" style={{ fontFamily: 'var(--font-lora), Georgia, serif', color: valueColor ? 'var(--c)' : undefined }}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </>
  ))
}

// D. Split card: a solid block of the colour (darkened, so white stays readable) holding the icon and figure, the words beside it. For courses.
export function SplitCard({ color, icon: Icon, value, title, sub, href }: { color: string; icon: LucideIcon; value: React.ReactNode; title: string; sub?: React.ReactNode; href?: string }) {
  return wrap(href, 'flex overflow-hidden rounded-2xl border border-line bg-raised transition hover:bg-surface', colorVar(color), (
    <>
      <span data-block className="flex w-16 shrink-0 flex-col items-center justify-center gap-0.5 bg-[color-mix(in_srgb,var(--c)_68%,black)] py-3 text-white">
        <Icon size={18} aria-hidden="true" /><span className="text-xl font-medium leading-none">{value}</span>
      </span>
      <span className="min-w-0 flex-1 px-3.5 py-3">
        <span className="block truncate font-medium">{title}</span>
        {sub && <span className="block truncate text-sm text-muted">{sub}</span>}
      </span>
    </>
  ))
}

// C. Open strip: big figures on the page divided by thin rules, no boxes. For study totals.
export function StatStrip({ label, items }: { label: string; items: { label: string; value: string; sub?: string }[] }) {
  if (items.length === 0) return null
  return (
    <ul aria-label={label} className="grid grid-cols-2 border-y border-line md:grid-cols-4">
      {items.map((it, i) => (
        <li key={it.label} className={`px-4 py-3.5 ${i % 2 === 1 ? 'border-l border-line' : ''} md:border-l ${i % 4 === 0 ? 'md:border-l-0' : ''} ${i >= 2 ? 'border-t border-line' : ''} ${i >= 4 ? 'md:border-t' : 'md:border-t-0'}`}>
          <div className="text-xs text-muted">{it.label}</div>
          <div className="mt-0.5 truncate text-3xl font-medium leading-tight">{it.value}</div>
          {it.sub && <div className="text-xs text-muted">{it.sub}</div>}
        </li>
      ))}
    </ul>
  )
}
