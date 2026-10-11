import { describe, it, expect } from 'vitest'
import { newUser } from './helpers'

type U = Awaited<ReturnType<typeof newUser>>
const topic = async (u: U) => {
  const c = (await u.sb.from('courses').insert({ name: 'Biology', color: '#1D9E75' }).select('id').single()).data!.id as string
  return (await u.sb.from('topics').insert({ course_id: c, name: 'Krebs cycle' }).select('id').single()).data!.id as string
}
const add = (u: U, topicId: string, over: object = {}) =>
  u.sb.from('topic_resources').insert({ topic_id: topicId, url: 'https://www.youtube.com/watch?v=abc', title: 'Krebs cycle explained', kind: 'video', ...over })

describe('topic_resources', () => {
  it('a student keeps links on their own topics and sees only their own', async () => {
    const u = await newUser(), other = await newUser()
    const t = await topic(u)
    expect((await add(u, t)).error).toBeNull()
    expect((await u.sb.from('topic_resources').select('id')).data).toHaveLength(1)
    expect((await other.sb.from('topic_resources').select('id')).data).toEqual([])
    expect((await add(other, t)).error).not.toBeNull() // someone else's topic
  })
  it('accepts only web addresses, sensible lengths and a known kind', async () => {
    const u = await newUser(), t = await topic(u)
    for (const bad of [{ url: 'javascript:alert(1)' }, { url: 'ftp://x.test/a' }, { url: 'https://x.test/' + 'a'.repeat(500) }, { title: '' }, { title: 'a'.repeat(201) }, { kind: 'podcast' }]) {
      expect((await add(u, t, bad)).error, JSON.stringify(bad).slice(0, 60)).not.toBeNull()
    }
  })
  it('keeps one copy of an address per topic', async () => {
    const u = await newUser(), t = await topic(u)
    expect((await add(u, t)).error).toBeNull()
    expect((await add(u, t)).error).not.toBeNull()
  })
  it('allows at most 20 links for a topic', async () => {
    const u = await newUser(), t = await topic(u)
    const rows = Array.from({ length: 20 }, (_, i) => ({ topic_id: t, url: `https://x.test/${i}`, title: `T${i}`, kind: 'article' }))
    expect((await u.sb.from('topic_resources').insert(rows)).error).toBeNull()
    expect((await add(u, t, { url: 'https://x.test/21' })).error).not.toBeNull()
  })
  it('does not let a link be moved into a topic that is already full', async () => {
    const u = await newUser()
    const full = await topic(u), other = await topic(u)
    await u.sb.from('topic_resources').insert(Array.from({ length: 20 }, (_, i) => ({ topic_id: full, url: `https://x.test/${i}`, title: `T${i}`, kind: 'article' })))
    await add(u, other, { url: 'https://x.test/moved' })
    const moved = await u.sb.from('topic_resources').update({ topic_id: full }).eq('url', 'https://x.test/moved')
    expect(moved.error).not.toBeNull()
  })
  it('goes with its topic', async () => {
    const u = await newUser(), t = await topic(u)
    await add(u, t)
    await u.sb.from('topics').delete().eq('id', t)
    expect((await u.sb.from('topic_resources').select('id')).data).toEqual([])
  })
})
