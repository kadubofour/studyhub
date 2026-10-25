'use client'
import { Flame } from 'lucide-react'
import { Avatar } from '@/components/profile/Avatar'
import type { BoardView, RankedRow } from '@/lib/social/rank'

// This week or All time: the look of the app's other two-way switches (the note sheet's Write / Read)
export function ViewSwitch({ value, onChange }: { value: BoardView; onChange: (v: BoardView) => void }) {
  const options: { value: BoardView; label: string }[] = [{ value: 'week', label: 'This week' }, { value: 'all', label: 'All time' }]
  return (
    <div role="radiogroup" aria-label="Board period" className="grid w-full grid-cols-2 gap-1 rounded-2xl bg-surface p-1 sm:w-72">
      {options.map(o => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => { if (value !== o.value) onChange(o.value) }}
          className={`min-h-9 rounded-xl text-sm font-medium transition pointer-coarse:min-h-11 ${value === o.value ? 'bg-raised text-fg shadow-sm' : 'text-muted hover:text-fg'}`}>{o.label}</button>
      ))}
    </div>
  )
}

const MEDAL = ['#E0A526', '#9AA4AE', '#B87445'] // gold, silver, bronze for the first three places

// The ranked rows: place, avatar, name with level and streak under it, and the XP of the view at the right.
// The student's own row is tinted and marked You.
export function Board({ rows, view, label }: { rows: RankedRow[]; view: BoardView; label: string }) {
  return (
    <ol aria-label={label} className="card divide-y divide-line overflow-hidden p-0">
      {rows.map(r => {
        const xp = view === 'week' ? r.week_xp : r.total_xp
        return (
          <li key={r.user_id} data-me={r.is_me || undefined}
            className={`flex min-w-0 items-center gap-3 px-4 py-3 sm:px-5 ${r.is_me ? 'bg-accent-soft' : ''}`}>
            <span aria-label={`Place ${r.place}`}
              className="grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold tabular-nums"
              style={r.place <= 3 && xp > 0 ? { background: `color-mix(in srgb, ${MEDAL[r.place - 1]} 22%, transparent)`, color: 'var(--fg)' } : { color: 'var(--muted)' }}>
              {r.place}
            </span>
            <Avatar name={r.display_name} color={r.avatar_color} size={36} />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <span data-name className="truncate text-[15px] font-medium">{r.display_name}</span>
                {r.is_me && <span className="shrink-0 rounded-full bg-accent-solid px-2 py-0.5 text-[11px] font-semibold text-white">You</span>}
              </div>
              <div className="mt-0.5 flex items-center gap-3 text-xs text-muted">
                <span>Level {r.level}</span>
                <span className="inline-flex items-center gap-1" title={`${r.streak}-day streak`}>
                  <Flame size={13} aria-hidden className={r.streak > 0 ? 'text-accent' : ''} />{r.streak}<span className="sr-only">-day streak</span>
                </span>
              </div>
            </div>
            <span className="shrink-0 text-right text-[15px] font-semibold tabular-nums">{xp.toLocaleString()} XP</span>
          </li>
        )
      })}
    </ol>
  )
}
