import { describe, it, expect } from 'vitest'
import { listRecentlyDone } from '@/lib/data/tasks'

function client(rows: unknown[], error: unknown = null) {
  const log: string[] = []
  const q: Record<string, unknown> = {}
  for (const k of ['from', 'select', 'not', 'gte', 'order', 'limit']) q[k] = (...a: unknown[]) => { log.push(`${k}(${a.map(String).join(',')})`); return q }
  q.then = (res: (v: unknown) => unknown) => res({ data: error ? null : rows, error })
  return { sb: q as never, log }
}

describe('listRecentlyDone', () => {
  it('asks for finished tasks since the cut-off, newest first, with a cap', async () => {
    const c = client([{ id: 't1' }])
    const rows = await listRecentlyDone(c.sb, new Date('2026-10-05T00:00:00Z'))
    expect(rows).toEqual([{ id: 't1' }])
    expect(c.log).toContain('from(tasks)')
    expect(c.log).toContain('not(done_at,is,null)')
    expect(c.log).toContain('gte(done_at,2026-10-05T00:00:00.000Z)')
    expect(c.log).toContain('order(done_at,[object Object])')
    expect(c.log).toContain('limit(50)')
  })
  it('throws when the read fails', async () => {
    await expect(listRecentlyDone(client([], { message: 'x' }).sb, new Date())).rejects.toBeTruthy()
  })
})
