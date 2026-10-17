import { describe, it, expect } from 'vitest'
import { listChatContexts } from '@/lib/data/tutor'

// A stand-in for the database that records how many ids each request carried
function fake() {
  const batches: { table: string; ids: string[] }[] = []
  const sb = { from: (table: string) => ({ select: () => ({ in: (_c: string, ids: string[]) => { batches.push({ table, ids }); return Promise.resolve({ data: ids.map(id => ({ id, title: `T-${id}` })), error: null }) } }) }) }
  return { sb: sb as never, batches }
}

describe('listChatContexts', () => {
  it('asks for the titles in batches, so that hundreds of chats do not make an address too long', async () => {
    const { sb, batches } = fake()
    const chats = Array.from({ length: 250 }, (_, i) => ({ id: `c${i}`, note_id: `n${i}`, lecture_id: null }))
    const out = await listChatContexts(sb, chats)
    expect(Object.keys(out)).toHaveLength(250)
    expect(out.c249).toEqual({ kind: 'note', title: 'T-n249' })
    expect(batches.map(b => b.ids.length)).toEqual([100, 100, 50])
    expect(batches.every(b => b.table === 'notes')).toBe(true)
  })
  it('asks for each note and lecture once, and not at all when no chat has one', async () => {
    const { sb, batches } = fake()
    const out = await listChatContexts(sb, [{ id: 'a', note_id: 'n1', lecture_id: null }, { id: 'b', note_id: 'n1', lecture_id: null }, { id: 'c', note_id: null, lecture_id: 'l1' }, { id: 'd', note_id: null, lecture_id: null }])
    expect(batches).toEqual([{ table: 'notes', ids: ['n1'] }, { table: 'lectures', ids: ['l1'] }])
    expect(out).toEqual({ a: { kind: 'note', title: 'T-n1' }, b: { kind: 'note', title: 'T-n1' }, c: { kind: 'lecture', title: 'T-l1' } })
    const none = fake()
    expect(await listChatContexts(none.sb, [{ id: 'd', note_id: null, lecture_id: null }])).toEqual({})
    expect(none.batches).toEqual([])
  })
})
