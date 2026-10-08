import { describe, it, expect, vi } from 'vitest'
import { listCourseMaterial, listTopicLinks, listTopicStats, saveCourseTopics } from '@/lib/data/topics'

const builder = (result: object) => {
  const calls: [string, unknown[]][] = []
  const b: Record<string, unknown> = {}
  for (const k of ['select', 'eq', 'order']) b[k] = (...a: unknown[]) => { calls.push([k, a]); return b }
  b.then = (res: (v: unknown) => unknown) => res(result)
  return { b, calls }
}
const sbWith = (tables: Record<string, object>, rpc?: object) => {
  const used: Record<string, ReturnType<typeof builder>> = {}
  const sb = {
    from: vi.fn((t: string) => (used[t] = builder(tables[t])).b),
    rpc: vi.fn(async () => rpc),
  } as never
  return { sb, used }
}

describe('topic data', () => {
  it('reads the stats with the database function', async () => {
    const { sb } = sbWith({}, { data: [{ topic_id: 't1' }], error: null })
    expect(await listTopicStats(sb, 'c1')).toEqual([{ topic_id: 't1' }])
    expect((sb as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc).toHaveBeenCalledWith('topic_stats', { p_course: 'c1' })
  })
  it('turns link rows into kind and id', async () => {
    const { sb } = sbWith({ topic_links: { data: [
      { topic_id: 't1', note_id: 'n1', lecture_id: null, deck_id: null },
      { topic_id: 't1', note_id: null, lecture_id: 'l1', deck_id: null },
      { topic_id: 't2', note_id: null, lecture_id: null, deck_id: 'd1' },
    ], error: null } })
    expect(await listTopicLinks(sb, 'c1')).toEqual([
      { topic_id: 't1', link: { kind: 'note', id: 'n1' } }, { topic_id: 't1', link: { kind: 'lecture', id: 'l1' } }, { topic_id: 't2', link: { kind: 'deck', id: 'd1' } },
    ])
  })
  it('lists the course\'s notes, lectures and decks for the pickers', async () => {
    const { sb, used } = sbWith({
      notes: { data: [{ id: 'n1', title: 'Krebs' }], error: null }, lectures: { data: [{ id: 'l1', title: 'Bio' }], error: null }, decks: { data: [{ id: 'd1', name: 'Cells' }], error: null },
    })
    expect(await listCourseMaterial(sb, 'c1')).toEqual({ notes: [{ id: 'n1', title: 'Krebs' }], lectures: [{ id: 'l1', title: 'Bio' }], decks: [{ id: 'd1', name: 'Cells' }] })
    expect(used.notes.calls).toContainEqual(['eq', ['course_id', 'c1']])
  })
  it('saves the whole list through the all-or-none function, and throws if it fails', async () => {
    const ok = sbWith({}, { error: null })
    await saveCourseTopics(ok.sb, 'c1', [{ name: 'A', links: [{ kind: 'note', id: 'n1' }] }, { id: 't2', name: 'B', links: [] }])
    expect((ok.sb as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc).toHaveBeenCalledWith('save_course_topics', {
      p_course: 'c1', p_topics: [{ name: 'A', links: [{ kind: 'note', id: 'n1' }] }, { id: 't2', name: 'B', links: [] }],
    })
    const bad = sbWith({}, { error: { message: 'duplicate' } })
    await expect(saveCourseTopics(bad.sb, 'c1', [])).rejects.toBeTruthy()
  })
})
