import { describe, it, expect, vi, beforeEach } from 'vitest'

let links: { topic_id: string; link: { kind: 'note' | 'lecture' | 'deck'; id: string } }[]
let newest: { id: string }[] | null
const createChat = vi.fn(async (..._a: unknown[]) => ({ id: 'chat9' }))
vi.mock('@/lib/data/topics', () => ({ listTopicLinks: async () => links }))
vi.mock('@/lib/data/tutor', () => ({ createChat: (...a: unknown[]) => createChat(...a) }))
import { startRevision } from '@/lib/tutor/revise'

const calls: [string, unknown[]][] = []
const sb = {
  from: () => {
    const q: Record<string, unknown> = {}
    for (const k of ['select', 'in', 'order', 'limit']) q[k] = (...a: unknown[]) => { calls.push([k, a]); return q }
    q.then = (res: (v: unknown) => unknown) => res({ data: newest, error: null })
    return q
  },
} as never
beforeEach(() => { links = []; newest = null; calls.length = 0; createChat.mockClear() })

describe('startRevision', () => {
  it('makes a chat about the topic on its newest linked note, in its course, and returns the address with the message ready', async () => {
    links = [
      { topic_id: 't1', link: { kind: 'note', id: 'n1' } }, { topic_id: 't1', link: { kind: 'note', id: 'n2' } },
      { topic_id: 't1', link: { kind: 'lecture', id: 'l1' } }, { topic_id: 't2', link: { kind: 'note', id: 'other' } },
    ]
    newest = [{ id: 'n2' }]
    const href = await startRevision(sb, { id: 't1', name: 'Krebs cycle' }, 'c1')
    expect(calls).toContainEqual(['in', ['id', ['n1', 'n2']]])
    expect(calls).toContainEqual(['order', ['updated_at', { ascending: false }]])
    expect(createChat).toHaveBeenCalledWith(sb, { title: 'Krebs cycle', course_id: 'c1', note_id: 'n2' })
    expect(href).toBe('/tutor/chat9?ask=Quiz%20me%20on%20Krebs%20cycle')
  })
  it('a topic with no linked note gets a chat on the course only', async () => {
    links = [{ topic_id: 't1', link: { kind: 'deck', id: 'd1' } }]
    await startRevision(sb, { id: 't1', name: 'Krebs cycle' }, 'c1')
    expect(createChat).toHaveBeenCalledWith(sb, { title: 'Krebs cycle', course_id: 'c1' })
    expect(calls).toEqual([]) // no notes to look up
  })
  it('keeps odd characters in a name intact through the address', async () => {
    const name = 'Acids & bases? "pH" 100%'
    const href = await startRevision(sb, { id: 't1', name }, 'c1')
    expect(new URL(href, 'http://x').searchParams.get('ask')).toBe(`Quiz me on ${name}`)
  })
  it('a failure to make the chat is passed on', async () => {
    createChat.mockRejectedValueOnce(new Error('rls'))
    await expect(startRevision(sb, { id: 't1', name: 'A' }, 'c1')).rejects.toThrow('rls')
  })
})
