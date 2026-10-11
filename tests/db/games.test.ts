import { describe, it, expect } from 'vitest'
import { newUser } from './helpers'

type U = Awaited<ReturnType<typeof newUser>>
const deck = async (u: U) => (await u.sb.from('decks').insert({ name: 'Cells' }).select('id').single()).data!.id as string
const play = (u: U, over: object) => u.sb.from('game_plays').insert({ game: 'speed', score: 3, total: 5, ...over })

describe('game_plays', () => {
  it('a student records plays on their own deck and sees only their own', async () => {
    const u = await newUser(), other = await newUser()
    const d = await deck(u)
    expect((await play(u, { deck_id: d })).error).toBeNull()
    expect((await u.sb.from('game_plays').select('id')).data).toHaveLength(1)
    expect((await other.sb.from('game_plays').select('id')).data).toEqual([])
    expect((await play(other, { deck_id: d })).error).not.toBeNull() // someone else's deck
  })
  it('rejects a bad game, a score above the total, and an empty total', async () => {
    const u = await newUser()
    for (const bad of [{ game: 'chess' }, { score: 6 }, { score: -1 }, { total: 0 }, { total: 31 }]) {
      expect((await play(u, bad)).error, JSON.stringify(bad)).not.toBeNull()
    }
  })
  it('keeps the play when its deck is deleted', async () => {
    const u = await newUser()
    const d = await deck(u)
    await play(u, { deck_id: d })
    await u.sb.from('decks').delete().eq('id', d)
    expect((await u.sb.from('game_plays').select('deck_id')).data).toEqual([{ deck_id: null }])
  })
  it('shows up in activity_by_day as games on the local day', async () => {
    const u = await newUser()
    await play(u, { created_at: '2026-03-10T03:30:00Z' })
    await play(u, { created_at: '2026-03-10T05:00:00Z' })
    const rows = (await u.sb.rpc('activity_by_day', { p_tz: 'America/New_York' })).data as { day: string; games: number }[]
    expect(rows.find(r => r.day === '2026-03-09')?.games).toBe(1)
    expect(rows.find(r => r.day === '2026-03-10')?.games).toBe(1)
  })
})
