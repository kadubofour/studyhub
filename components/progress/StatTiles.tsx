import type { LucideIcon } from 'lucide-react'

// A few numbers that matter, each in plain words on a soft tile with a line about it, so a quiet week reads as a place to begin
export type Stat = { label: string; value: string; sub: string; icon: LucideIcon; tone: 'a' | 'b' | 'c' }
export function StatTiles({ stats }: { stats: Stat[] }) {
  return (
    <ul aria-label="Study stats" className="grid gap-3 sm:grid-cols-3">
      {stats.map(({ label, value, sub, icon: Icon, tone }) => (
        <li key={label} className="card flex items-center gap-4 !p-5">
          <span aria-hidden className={`tile-${tone} grid size-12 shrink-0 place-items-center rounded-2xl border border-line`}><Icon size={22} /></span>
          <div className="min-w-0">
            <div className="text-[13px] text-muted">{label}</div>
            <div className="truncate text-2xl font-semibold leading-tight tabular-nums">{value}</div>
            <div className="truncate text-xs text-muted">{sub}</div>
          </div>
        </li>
      ))}
    </ul>
  )
}
