import { describe, it, expect } from 'vitest'
import { rankRows, type BoardRow } from '@/lib/social/rank'
import { levelInfo } from '@/lib/xp/rules'

const row = (name: string, week_xp: number, total_xp: number, streak = 0, is_me = false): BoardRow =>
  ({ user_id: name, display_name: name, avatar_color: '#123456', week_xp, total_xp, streak, is_me })

describe('rankRows', () => {
  it('sorts by XP, then streak, then name, and ties share a place', () => {
    const ranked = rankRows([row('Esi', 50, 0, 1), row('Ama', 90, 0, 2), row('Kofi', 50, 0, 1), row('Yaw', 50, 0, 3), row('Abe', 10, 0)], 'week')
    expect(ranked.map(r => [r.display_name, r.place])).toEqual([['Ama', 1], ['Yaw', 2], ['Esi', 3], ['Kofi', 3], ['Abe', 5]])
  })
  it('the week view ignores total', () => {
    const ranked = rankRows([row('Ama', 10, 9000), row('Kofi', 40, 100)], 'week')
    expect(ranked.map(r => r.display_name)).toEqual(['Kofi', 'Ama'])
  })
  it('the all-time view sorts by total', () => {
    const ranked = rankRows([row('Ama', 10, 9000), row('Kofi', 40, 100)], 'all')
    expect(ranked.map(r => r.display_name)).toEqual(['Ama', 'Kofi'])
  })
  it('the level comes from total', () => {
    const [r] = rankRows([row('Ama', 5, 2400)], 'week')
    expect(r.level).toBe(levelInfo(2400).level)
    expect(r.level).toBeGreaterThan(1)
  })
  it('does not change the rows it was given', () => {
    const rows = [row('B', 1, 1), row('A', 2, 2)]
    rankRows(rows, 'week')
    expect(rows.map(r => r.display_name)).toEqual(['B', 'A'])
  })
})
