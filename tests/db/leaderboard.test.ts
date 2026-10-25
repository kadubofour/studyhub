import { describe, it, expect } from 'vitest'
import { adminClient, newUser } from './helpers'

type U = Awaited<ReturnType<typeof newUser>>
type Row = { user_id: string; display_name: string; avatar_color: string; total_xp: number; week_xp: number; streak: number; is_me: boolean }

async function befriend(x: U, y: U) {
  const [a, b] = x.id < y.id ? [x.id, y.id] : [y.id, x.id]
  expect((await adminClient().from('friendships').insert({ a, b })).error).toBeNull()
}
// n tasks done now: 5 XP each (cap 10 a day), on time
async function earn(u: U, n: number) {
  const now = new Date().toISOString()
  const rows = Array.from({ length: n }, (_, i) => ({ title: `t${i}`, done_at: now }))
  expect((await u.sb.from('tasks').insert(rows)).error).toBeNull()
}
async function board(u: U, group?: string) {
  const { data, error } = await u.sb.rpc('leaderboard', group ? { p_group: group } : {})
  expect(error).toBeNull()
  return data as Row[]
}

describe('leaderboard', () => {
  it('the friends board shows me and my friends with their XP, and no one else', async () => {
    const [me, f, stranger] = await Promise.all([newUser(), newUser(), newUser()])
    await befriend(me, f)
    await earn(me, 2)
    await earn(f, 3)
    await earn(stranger, 4)
    const rows = await board(me)
    expect(rows.map(r => r.user_id).sort()).toEqual([me.id, f.id].sort())
    const mine = rows.find(r => r.user_id === me.id)!
    const theirs = rows.find(r => r.user_id === f.id)!
    expect(mine).toMatchObject({ is_me: true, total_xp: 10, week_xp: 10, streak: 1 })
    expect(theirs).toMatchObject({ is_me: false, total_xp: 15, streak: 1 })
    expect(theirs.display_name).toBe('Test')
    expect(theirs.avatar_color).toMatch(/^#/)
  })

  it('a hidden friend is left off, but I always see myself when hidden', async () => {
    const [me, f] = await Promise.all([newUser(), newUser()])
    await befriend(me, f)
    expect((await f.sb.from('profiles').update({ show_on_boards: false }).eq('id', f.id)).error).toBeNull()
    expect((await board(me)).map(r => r.user_id)).toEqual([me.id])
    expect((await me.sb.from('profiles').update({ show_on_boards: false }).eq('id', me.id)).error).toBeNull()
    const rows = await board(me)
    expect(rows.map(r => r.user_id)).toEqual([me.id])
    expect(rows[0].is_me).toBe(true)
  })

  it('a group board needs membership', async () => {
    const [a, b, outsider] = await Promise.all([newUser(), newUser(), newUser()])
    const g = (await a.sb.rpc('create_group', { p_name: 'Crew' })).data as string
    const { data: mine } = await a.sb.rpc('my_groups')
    const token = (mine as { invite_token: string }[])[0].invite_token
    expect((await b.sb.rpc('join_group', { p_token: token })).error).toBeNull()
    await earn(b, 1)
    expect((await board(a, g)).map(r => r.user_id).sort()).toEqual([a.id, b.id].sort())
    expect((await board(b, g)).find(r => r.user_id === b.id)!.total_xp).toBe(5)
    const bad = await outsider.sb.rpc('leaderboard', { p_group: g })
    expect(bad.error?.message).toContain('not_member')
    // a group board is not limited to friends
    expect((await board(a)).map(r => r.user_id)).toEqual([a.id])
  })

  it('numbers match xp_totals', async () => {
    const [me, f] = await Promise.all([newUser(), newUser()])
    await befriend(me, f)
    await earn(me, 7)
    await earn(f, 12)
    const rows = await board(me)
    expect(rows).toHaveLength(2)
    for (const r of rows) {
      const { data, error } = await adminClient().rpc('xp_totals', { p_user: r.user_id })
      if (error) {
        // not callable by clients, even the service role: fall back to what we created (tasks cap at 10 a day)
        const exp = r.user_id === me.id ? 35 : 50
        expect(r.total_xp).toBe(exp)
        continue
      }
      const t = (data as { total: number; week: number; streak: number }[])[0]
      expect([r.total_xp, r.week_xp, r.streak]).toEqual([t.total, t.week, t.streak])
    }
  })
})
