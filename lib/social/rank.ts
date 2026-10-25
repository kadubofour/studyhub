import { levelInfo } from '@/lib/xp/rules'

// One student on a board, as the `leaderboard` function returns them
export interface BoardRow {
  user_id: string; display_name: string; avatar_color: string
  total_xp: number; week_xp: number; streak: number; is_me: boolean
}
export type RankedRow = BoardRow & { place: number; level: number }
export type BoardView = 'week' | 'all'

// Most XP first (this week's or all of it), then the longer streak, then by name. The same XP and streak share a place
// (1, 1, 3). The level always comes from all-time XP, as it does on the student's own profile.
export function rankRows(rows: BoardRow[], view: BoardView): RankedRow[] {
  const xp = (r: BoardRow) => (view === 'week' ? r.week_xp : r.total_xp)
  const sorted = [...rows].sort((a, b) => xp(b) - xp(a) || b.streak - a.streak || a.display_name.localeCompare(b.display_name))
  const out: RankedRow[] = []
  sorted.forEach((r, i) => {
    const prev = out[i - 1]
    const place = prev && xp(prev) === xp(r) && prev.streak === r.streak ? prev.place : i + 1
    out.push({ ...r, place, level: levelInfo(r.total_xp).level })
  })
  return out
}
