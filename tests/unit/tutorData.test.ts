import { describe, it, expect, vi } from 'vitest'
import { createChat, findChat, saveProposals } from '@/lib/data/tutor'

const q = (result: object) => {
  const calls: [string, unknown[]][] = []
  const b: Record<string, unknown> = {}
  for (const k of ['select', 'insert', 'update', 'eq', 'order', 'limit']) b[k] = (...a: unknown[]) => { calls.push([k, a]); return b }
  b.maybeSingle = async () => result
  b.single = async () => result
  b.then = (res: (v: unknown) => unknown) => res(result)
  return { b, calls }
}
const sbOf = (b: unknown) => ({ from: vi.fn(() => b) }) as never

describe('tutor data', () => {
  it('creates a chat with its links', async () => {
    const { b, calls } = q({ data: { id: 'c1' }, error: null })
    await createChat(sbOf(b), { title: 'Krebs', note_id: 'n1', course_id: null })
    expect(calls.find(c => c[0] === 'insert')![1][0]).toEqual({ title: 'Krebs', note_id: 'n1', course_id: null })
  })
  it('finds the newest chat for a note or a lecture, or null', async () => {
    const { b, calls } = q({ data: { id: 'c1' }, error: null })
    expect(await findChat(sbOf(b), { note_id: 'n1' })).toEqual({ id: 'c1' })
    expect(calls).toContainEqual(['eq', ['note_id', 'n1']])
    expect(calls).toContainEqual(['order', ['updated_at', { ascending: false }]])
    expect(await findChat(sbOf(q({ data: null, error: null }).b), { lecture_id: 'l1' })).toBeNull()
  })
  it('saves a message\'s proposals', async () => {
    const { b, calls } = q({ error: null })
    await saveProposals(sbOf(b), 'm1', [])
    expect(calls).toContainEqual(['update', [{ proposals: [] }]])
    expect(calls).toContainEqual(['eq', ['id', 'm1']])
  })
})
