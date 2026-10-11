import { describe, it, expect, vi } from 'vitest'
import { listResources, saveResources } from '@/lib/data/resources'

describe('resources data', () => {
  it('saves a batch with times that keep the order it came in', async () => {
    const upsert = vi.fn(async (..._a: unknown[]) => ({ error: null }))
    const sb = { from: () => ({ upsert }) }
    await saveResources(sb as never, 't1', [
      { url: 'https://a.test/1', title: 'A', kind: 'video' }, { url: 'https://a.test/2', title: 'B', kind: 'article' }, { url: 'https://a.test/3', title: 'C', kind: 'article' },
    ])
    const rows = upsert.mock.calls[0][0] as { created_at: string; url: string }[]
    const times = rows.map(r => Date.parse(r.created_at))
    expect(times[0]).toBeLessThan(times[1])
    expect(times[1]).toBeLessThan(times[2])
    expect(rows.map(r => r.url)).toEqual(['https://a.test/1', 'https://a.test/2', 'https://a.test/3'])
  })
  it('saves the channel and length of a video as columns', async () => {
    const upsert = vi.fn(async (..._a: unknown[]) => ({ error: null }))
    await saveResources({ from: () => ({ upsert }) } as never, 't1', [{ url: 'https://www.youtube.com/watch?v=1', title: 'A', kind: 'video', channel: 'Chan', seconds: 600 }, { url: 'https://a.test', title: 'B', kind: 'article' }])
    const rows = upsert.mock.calls[0][0] as Record<string, unknown>[]
    expect(rows[0]).toMatchObject({ channel: 'Chan', duration_seconds: 600 })
    expect(rows[0]).not.toHaveProperty('seconds')
    expect(rows[1].channel ?? null).toBeNull()
  })
  it('lists videos first, then by when they were saved', async () => {
    const order = vi.fn()
    const q: Record<string, unknown> = {}
    q.select = () => q; q.eq = () => q
    q.order = (col: string, o: unknown) => { order(col, o); return q }
    q.then = (res: (v: unknown) => unknown) => res({ data: [], error: null })
    await listResources({ from: () => q } as never, 't1')
    expect(order.mock.calls.map(c => c[0])).toEqual(['kind', 'created_at', 'id'])
    expect(order.mock.calls[0][1]).toEqual({ ascending: false })
  })
})
