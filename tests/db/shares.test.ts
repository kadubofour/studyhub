import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { adminClient, newUser } from './helpers'

type U = Awaited<ReturnType<typeof newUser>>

function anon() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
async function deck(u: U, name = 'Bio', cards: [string, string][] = [['cell', 'unit of life'], ['atp', 'energy']]) {
  const d = await u.sb.from('decks').insert({ name }).select('id').single()
  expect(d.error).toBeNull()
  const id = d.data!.id as string
  const c = await u.sb.from('cards').insert(cards.map(([front, back]) => ({ deck_id: id, front, back })))
  expect(c.error).toBeNull()
  return id
}
async function note(u: U, title = 'Notes', content_md = 'hello', notebook_id?: string) {
  const r = await u.sb.from('notes').insert({ title, content_md, notebook_id }).select('id').single()
  expect(r.error).toBeNull()
  return r.data!.id as string
}
async function share(u: U, kind: string, item: string) {
  const { data, error } = await u.sb.rpc('share_item', { p_kind: kind, p_item: item })
  expect(error).toBeNull()
  return data as string
}

describe('shares', () => {
  it('anyone (anon) can read a shared deck, and only that deck', async () => {
    const a = await newUser()
    const d = await deck(a)
    await deck(a, 'Other')
    const t = await share(a, 'deck', d)
    expect(t.length).toBeGreaterThanOrEqual(22)
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(await share(a, 'deck', d)).toBe(t)

    const { data, error } = await anon().rpc('shared_item', { p_token: t })
    expect(error).toBeNull()
    expect(data.kind).toBe('deck')
    expect(data.item.name).toBe('Bio')
    expect(data.item.cards).toHaveLength(2)
    expect(Object.keys(data.item.cards[0]).sort()).toEqual(['back', 'front'])
    const text = JSON.stringify(data)
    expect(text).not.toContain(a.id)
    expect(text).not.toMatch(/user_id|email|course/)
    expect(Object.keys(data.owner).sort()).toEqual(['accent', 'avatar_color', 'display_name', 'look'])
    expect(data.owner.display_name).toBe('Test')
    // anon cannot read the table or list other decks
    expect((await anon().from('shares').select('*')).error).not.toBeNull()
    expect((await anon().from('decks').select('*')).data).toEqual([])
  })

  it('a revoked link returns null and cannot be copied (link_off)', async () => {
    const [a, b] = await Promise.all([newUser(), newUser()])
    const d = await deck(a)
    const t = await share(a, 'deck', d)
    expect((await a.sb.rpc('unshare_item', { p_kind: 'deck', p_item: d })).error).toBeNull()
    expect((await anon().rpc('shared_item', { p_token: t })).data).toBeNull()
    expect((await b.sb.rpc('copy_shared', { p_token: t })).error?.message).toContain('link_off')
    expect((await b.sb.rpc('copy_shared', { p_token: 'nope' })).error?.message).toContain('link_off')
    // sharing again makes a new token; reshare replaces it
    const t2 = await share(a, 'deck', d)
    expect(t2).not.toBe(t)
    const r = await a.sb.rpc('reshare_item', { p_kind: 'deck', p_item: d })
    expect(r.error).toBeNull()
    expect(r.data).not.toBe(t2)
    expect((await anon().rpc('shared_item', { p_token: t2 })).data).toBeNull()
    expect((await anon().rpc('shared_item', { p_token: r.data })).data).not.toBeNull()
  })

  it('deleting the item turns its link off', async () => {
    const a = await newUser()
    const d = await deck(a)
    const n = await note(a)
    const nb = await a.sb.from('notebooks').insert({ name: 'NB' }).select('id').single()
    const td = await share(a, 'deck', d)
    const tn = await share(a, 'note', n)
    const tb = await share(a, 'notebook', nb.data!.id)
    await a.sb.from('decks').delete().eq('id', d)
    await a.sb.from('notes').delete().eq('id', n)
    await a.sb.from('notebooks').delete().eq('id', nb.data!.id)
    for (const t of [td, tn, tb]) expect((await anon().rpc('shared_item', { p_token: t })).data).toBeNull()
  })

  it('copy_shared makes a separate deck with fresh cards', async () => {
    const [a, b] = await Promise.all([newUser(), newUser()])
    const d = await deck(a)
    // make the original cards look studied
    await a.sb.from('cards').update({ reps: 5, interval_days: 9, ease: 3.1, lapses: 2 }).eq('deck_id', d)
    const t = await share(a, 'deck', d)
    const { data, error } = await b.sb.rpc('copy_shared', { p_token: t })
    expect(error).toBeNull()
    expect(data[0].kind).toBe('deck')
    const id = data[0].id as string
    expect(id).not.toBe(d)
    await a.sb.from('decks').update({ name: 'Changed' }).eq('id', d)
    await a.sb.from('cards').update({ front: 'changed' }).eq('deck_id', d)
    const copy = await b.sb.from('decks').select('name, course_id, user_id').eq('id', id).single()
    expect(copy.data).toMatchObject({ name: 'Bio', course_id: null, user_id: b.id })
    const cards = await b.sb.from('cards').select('front, back, reps, interval_days, ease, lapses').eq('deck_id', id).order('front')
    expect(cards.data).toEqual([
      { front: 'atp', back: 'energy', reps: 0, interval_days: 0, ease: 2.5, lapses: 0 },
      { front: 'cell', back: 'unit of life', reps: 0, interval_days: 0, ease: 2.5, lapses: 0 },
    ])
    // copying your own share is allowed
    expect((await a.sb.rpc('copy_shared', { p_token: t })).error).toBeNull()
    // anon cannot copy
    expect((await anon().rpc('copy_shared', { p_token: t })).error).not.toBeNull()
  })

  it('only the owner can share an item', async () => {
    const [a, b] = await Promise.all([newUser(), newUser()])
    const d = await deck(a)
    for (const fn of ['share_item', 'reshare_item', 'unshare_item']) {
      const r = await b.sb.rpc(fn, { p_kind: 'deck', p_item: d })
      expect(r.error?.message).toContain('not_owner')
    }
    expect((await b.sb.rpc('share_item', { p_kind: 'bogus', p_item: d })).error).not.toBeNull()
    expect((await anon().rpc('share_item', { p_kind: 'deck', p_item: d })).error).not.toBeNull()
    // owner may read own rows, others may not, nobody writes
    const t = await share(a, 'deck', d)
    expect((await a.sb.from('shares').select('token')).data).toEqual([{ token: t }])
    expect((await b.sb.from('shares').select('token')).data).toEqual([])
    expect((await a.sb.from('shares').update({ revoked_at: null }).eq('token', t)).error).not.toBeNull()
  })

  it('share_progress snapshots the numbers', async () => {
    const a = await newUser()
    const now = new Date()
    const ins = await a.sb.from('focus_sessions').insert({
      started_at: new Date(now.getTime() - 60_000).toISOString(), ended_at: now.toISOString(), minutes: 30, completed: true })
    expect(ins.error).toBeNull()
    const { data: t, error } = await a.sb.rpc('share_progress')
    expect(error).toBeNull()
    const { data } = await anon().rpc('shared_item', { p_token: t })
    expect(data.kind).toBe('progress')
    expect(Object.keys(data.item).sort()).toEqual(
      ['avatar_color', 'display_name', 'level', 'streak', 'total_xp', 'week_focus_minutes', 'week_xp'])
    expect(data.item.week_focus_minutes).toBeGreaterThanOrEqual(0)
    expect(data.item.total_xp).toBeGreaterThan(0)
    expect(data.item.level).toBe(Math.floor(Math.sqrt(data.item.total_xp / 50)) + 1)
    const t2 = (await a.sb.rpc('share_progress')).data
    expect(t2).not.toBe(t)
    expect((await a.sb.rpc('copy_shared', { p_token: t })).error?.message).toContain('not_copyable')
  })

  it('a notebook copy brings its notes; a note copy is unfiled; deleting a note revokes its share', async () => {
    const [a, b] = await Promise.all([newUser(), newUser()])
    const nb = (await a.sb.from('notebooks').insert({ name: 'Chem' }).select('id').single()).data!.id as string
    await note(a, 'One', 'first', nb)
    await note(a, 'Two', 'second', nb)
    const tb = await share(a, 'notebook', nb)
    const shown = (await anon().rpc('shared_item', { p_token: tb })).data
    expect(shown.item.name).toBe('Chem')
    expect(shown.item.notes.map((n: { title: string }) => n.title).sort()).toEqual(['One', 'Two'])
    expect(Object.keys(shown.item.notes[0]).sort()).toEqual(['content_md', 'id', 'title'])

    const c = await b.sb.rpc('copy_shared', { p_token: tb })
    expect(c.error).toBeNull()
    expect(c.data[0].kind).toBe('notebook')
    const copied = await b.sb.from('notes').select('title, content_md, course_id').eq('notebook_id', c.data[0].id).order('title')
    expect(copied.data).toEqual([
      { title: 'One', content_md: 'first', course_id: null },
      { title: 'Two', content_md: 'second', course_id: null },
    ])

    const n = await note(a, 'Solo', 'body')
    const tn = await share(a, 'note', n)
    const cn = await b.sb.rpc('copy_shared', { p_token: tn })
    expect(cn.data[0].kind).toBe('note')
    expect((await b.sb.from('notes').select('title, content_md, notebook_id, course_id').eq('id', cn.data[0].id).single()).data)
      .toEqual({ title: 'Solo', content_md: 'body', notebook_id: null, course_id: null })
    await a.sb.from('notes').delete().eq('id', n)
    expect((await anon().rpc('shared_item', { p_token: tn })).data).toBeNull()
  })

  it('shared_note_files lists valid picture files, only for the service role', async () => {
    const a = await newUser()
    const md = '![x](studyhub-image:abc_1.png) ![y](studyhub-image:abc_1.png) ![z](studyhub-image:../bad) ![w](studyhub-image:q-2)'
    const n = await note(a, 'Pics', md)
    const t = await share(a, 'note', n)
    const admin = adminClient()
    const r = await admin.rpc('shared_note_files', { p_token: t })
    expect(r.error).toBeNull()
    expect((r.data as { owner_id: string; file: string }[]).map(x => x.file).sort()).toEqual(['abc_1.png', 'q-2'])
    expect(r.data[0].owner_id).toBe(a.id)
    expect((await a.sb.rpc('shared_note_files', { p_token: t })).error).not.toBeNull()
    expect((await anon().rpc('shared_note_files', { p_token: t })).error).not.toBeNull()
    await a.sb.rpc('unshare_item', { p_kind: 'note', p_item: n })
    expect((await admin.rpc('shared_note_files', { p_token: t })).data).toEqual([])
  })
})
