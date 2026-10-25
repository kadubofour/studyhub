import { describe, it, expect } from 'vitest'
import { adminClient, newUser } from './helpers'

type U = Awaited<ReturnType<typeof newUser>>
type G = { id: string; name: string; is_owner: boolean; members: number; invite_token: string | null }

async function mk(u: U, name = 'Bio crew') {
  const { data, error } = await u.sb.rpc('create_group', { p_name: name })
  expect(error).toBeNull()
  return data as string
}
async function mine(u: U) {
  const { data, error } = await u.sb.rpc('my_groups')
  expect(error).toBeNull()
  return data as G[]
}
async function tokenOf(u: U, id: string) {
  return (await mine(u)).find(g => g.id === id)!.invite_token!
}
async function join(u: U, token: string) {
  const { data, error } = await u.sb.rpc('join_group', { p_token: token })
  expect(error).toBeNull()
  return (data as { status: string; group_id: string | null }[])[0]
}
async function memberIds(u: U, id: string) {
  const { data, error } = await u.sb.rpc('group_members_of', { p_group: id })
  expect(error).toBeNull()
  return (data as { user_id: string }[]).map(r => r.user_id)
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

describe('study groups', () => {
  it('join with the invite; the creator removes a member; a member cannot remove', async () => {
    const [a, b, c] = await Promise.all([newUser(), newUser(), newUser()])
    const g = await mk(a, '  Bio crew  ')
    const t = await tokenOf(a, g)
    expect(t.length).toBeGreaterThanOrEqual(22)
    expect((await mine(a))[0]).toMatchObject({ name: 'Bio crew', is_owner: true, members: 1 })

    expect(await join(b, t)).toEqual({ status: 'ok', group_id: g })
    expect(await join(c, t)).toEqual({ status: 'ok', group_id: g })
    expect(await join(b, t)).toEqual({ status: 'ok', group_id: g }) // already in: no duplicate
    expect((await mine(a))[0].members).toBe(3)

    const bg = (await mine(b))[0]
    expect(bg).toMatchObject({ is_owner: false, invite_token: null, members: 3 })
    const { data: ms } = await b.sb.rpc('group_members_of', { p_group: g })
    expect((ms as { user_id: string; is_owner: boolean }[]).find(m => m.user_id === a.id)!.is_owner).toBe(true)

    const bad = await b.sb.rpc('remove_member', { p_group: g, p_user: c.id })
    expect(bad.error?.message).toContain('not_owner')
    expect((await b.sb.rpc('rename_group', { p_group: g, p_name: 'x' })).error?.message).toContain('not_owner')
    expect((await b.sb.rpc('new_group_invite', { p_group: g })).error?.message).toContain('not_owner')
    expect((await b.sb.rpc('delete_group', { p_group: g })).error?.message).toContain('not_owner')

    expect((await a.sb.rpc('remove_member', { p_group: g, p_user: c.id })).error).toBeNull()
    expect(await mine(c)).toEqual([])
    expect((await memberIds(a, g)).sort()).toEqual([a.id, b.id].sort())

    expect((await a.sb.rpc('rename_group', { p_group: g, p_name: ' Chem ' })).error).toBeNull()
    expect((await mine(a))[0].name).toBe('Chem')
    expect((await a.sb.rpc('rename_group', { p_group: g, p_name: '   ' })).error).not.toBeNull()
    expect((await a.sb.rpc('rename_group', { p_group: g, p_name: 'x'.repeat(61) })).error).not.toBeNull()
    expect((await a.sb.rpc('create_group', { p_name: '' })).error).not.toBeNull()
  })

  it('a new invite stops the old one', async () => {
    const [a, b, c] = await Promise.all([newUser(), newUser(), newUser()])
    const g = await mk(a)
    const old = await tokenOf(a, g)
    const { data: fresh, error } = await a.sb.rpc('new_group_invite', { p_group: g })
    expect(error).toBeNull()
    expect(fresh).not.toBe(old)
    expect((await join(b, old)).status).toBe('not_found')
    expect(await mine(b)).toEqual([])
    expect((await join(c, fresh as string)).status).toBe('ok')
  })

  it('group_preview shows only name and member count', async () => {
    const [a, b] = await Promise.all([newUser(), newUser()])
    const g = await mk(a, 'Preview me')
    const t = await tokenOf(a, g)
    const { data, error } = await b.sb.rpc('group_preview', { p_token: t })
    expect(error).toBeNull()
    expect(data).toEqual([{ name: 'Preview me', members: 1 }])
    expect((await b.sb.rpc('group_preview', { p_token: 'nope' })).data).toEqual([])
  })

  it('the 51st join is group_full and nothing changes', async () => {
    const admin = adminClient()
    const owner = await newUser()
    const g = await mk(owner)
    const t = await tokenOf(owner, g)
    const fillers = await Promise.all(Array.from({ length: 49 }, () => newUser()))
    const { error } = await admin.from('group_members').insert(fillers.map(f => ({ group_id: g, user_id: f.id })))
    expect(error).toBeNull()
    const late = await newUser()
    expect((await join(late, t)).status).toBe('group_full')
    expect(await mine(late)).toEqual([])
    const { count } = await admin.from('group_members').select('*', { count: 'exact', head: true }).eq('group_id', g)
    expect(count).toBe(50)
    // a member already in is not turned away
    expect((await join(fillers[0], t)).status).toBe('ok')
  })

  it('concurrent joins cannot pass 50', async () => {
    const admin = adminClient()
    const owner = await newUser()
    const g = await mk(owner)
    const t = await tokenOf(owner, g)
    const fillers = await Promise.all(Array.from({ length: 47 }, () => newUser()))
    await admin.from('group_members').insert(fillers.map(f => ({ group_id: g, user_id: f.id })))
    const late = await Promise.all(Array.from({ length: 6 }, () => newUser()))
    const res = await Promise.all(late.map(u => join(u, t)))
    expect(res.filter(r => r.status === 'ok')).toHaveLength(2)
    expect(res.filter(r => r.status === 'group_full')).toHaveLength(4)
    const { count } = await admin.from('group_members').select('*', { count: 'exact', head: true }).eq('group_id', g)
    expect(count).toBe(50)
  })

  it('failed joins are throttled at 20 an hour', async () => {
    const u = await newUser()
    for (let i = 0; i < 20; i++) expect((await join(u, 'bad' + i)).status).toBe('not_found')
    expect((await join(u, 'bad')).status).toBe('rate_limited')
    const owner = await newUser()
    const g = await mk(owner)
    expect((await join(u, await tokenOf(owner, g))).status).toBe('rate_limited')
    expect(await mine(u)).toEqual([])
  })

  it('the creator leaving passes the group to the longest-standing member; the last to leave deletes it', async () => {
    const admin = adminClient()
    const [a, b, c] = await Promise.all([newUser(), newUser(), newUser()])
    const g = await mk(a)
    const t = await tokenOf(a, g)
    await join(b, t)
    await sleep(20)
    await join(c, t)
    expect((await a.sb.rpc('leave_group', { p_group: g })).error).toBeNull()
    expect(await mine(a)).toEqual([])
    const nb = (await mine(b))[0]
    expect(nb).toMatchObject({ is_owner: true })
    expect(nb.invite_token).toBeTruthy()
    expect((await mine(c))[0]).toMatchObject({ is_owner: false, invite_token: null })

    expect((await c.sb.rpc('leave_group', { p_group: g })).error).toBeNull()
    expect((await b.sb.rpc('leave_group', { p_group: g })).error).toBeNull()
    const { data } = await admin.from('study_groups').select('id').eq('id', g)
    expect(data).toEqual([])
    expect((await b.sb.rpc('leave_group', { p_group: g })).error?.message).toContain('not_member')
  })

  it('delete_group removes it for everyone', async () => {
    const [a, b] = await Promise.all([newUser(), newUser()])
    const g = await mk(a)
    await join(b, await tokenOf(a, g))
    expect((await a.sb.rpc('delete_group', { p_group: g })).error).toBeNull()
    expect(await mine(b)).toEqual([])
  })

  it('a non-member cannot see the group or its members', async () => {
    const [a, out] = await Promise.all([newUser(), newUser()])
    const g = await mk(a)
    expect(await mine(out)).toEqual([])
    expect((await out.sb.from('study_groups').select('id').eq('id', g)).data).toEqual([])
    expect((await out.sb.from('group_members').select('user_id').eq('group_id', g)).data).toEqual([])
    expect(await memberIds(out, g)).toEqual([])
    expect((await a.sb.from('study_groups').select('id').eq('id', g)).data).toHaveLength(1)
    // no direct writes
    expect((await out.sb.from('group_members').insert({ group_id: g, user_id: out.id })).error).not.toBeNull()
    expect((await out.sb.from('study_groups').insert({ name: 'x', owner_id: out.id, invite_token: 'zz' })).error).not.toBeNull()
    expect((await out.sb.rpc('leave_group', { p_group: g })).error?.message).toContain('not_member')
  })

  it("deleting the owner's account passes the group to the longest-standing member", async () => {
    const admin = adminClient()
    const [a, b, c, solo] = await Promise.all([newUser(), newUser(), newUser(), newUser()])
    const g = await mk(a)
    const t = await tokenOf(a, g)
    await join(b, t)
    await sleep(20)
    await join(c, t)
    const lone = await mk(solo)
    expect((await admin.auth.admin.deleteUser(a.id)).error).toBeNull()
    expect((await mine(b))[0]).toMatchObject({ id: g, is_owner: true, members: 2 })
    expect((await mine(b))[0].invite_token).toBeTruthy()
    expect((await mine(c))[0]).toMatchObject({ is_owner: false })
    expect((await admin.auth.admin.deleteUser(solo.id)).error).toBeNull()
    expect((await admin.from('study_groups').select('id').eq('id', lone)).data).toEqual([])
  })

  it('new groups are limited to 10 an hour', async () => {
    const u = await newUser()
    for (let i = 0; i < 10; i++) await mk(u, 'G' + i)
    const { error } = await u.sb.rpc('create_group', { p_name: 'one too many' })
    expect(error?.message).toContain('rate_limited')
    expect(await mine(u)).toHaveLength(10)
  })

  it('the invite token cannot be read from the table, by members or the owner', async () => {
    const [a, b] = await Promise.all([newUser(), newUser()])
    const g = await mk(a)
    await join(b, await tokenOf(a, g))
    for (const u of [a, b]) {
      expect((await u.sb.from('study_groups').select('invite_token').eq('id', g)).error).not.toBeNull()
      expect((await u.sb.from('study_groups').select('*').eq('id', g)).error).not.toBeNull()
      const ok = await u.sb.from('study_groups').select('id, name').eq('id', g)
      expect(ok.error).toBeNull()
      expect(ok.data).toHaveLength(1)
    }
  })
})
