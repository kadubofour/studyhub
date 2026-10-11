import { describe, it, expect, vi } from 'vitest'
import { parseDuration, searchVideos } from '@/lib/youtube'

const cfg = (fetchFn: typeof fetch) => ({ key: 'K', base: 'https://yt.test/v3', fetch: fetchFn })
const json = (data: unknown, ok = true) => ({ ok, status: ok ? 200 : 403, json: async () => data }) as Response
const hit = (id: string, over: object = {}) => ({ id: { videoId: id }, snippet: { title: `Title ${id}`, channelTitle: `Chan ${id}`, liveBroadcastContent: 'none', ...over } })
const detail = (id: string, duration: string, views = '1000') => ({ id, contentDetails: { duration }, statistics: { viewCount: views } })
const serve = (searchItems: unknown[], details: unknown[]) => vi.fn(async (url: string | URL | Request) => {
  const u = String(url)
  return u.includes('/search') ? json({ items: searchItems }) : json({ items: details })
}) as unknown as typeof fetch

describe('parseDuration', () => {
  it('reads ISO 8601 durations', () => {
    expect(parseDuration('PT15M33S')).toBe(933)
    expect(parseDuration('PT1H2M')).toBe(3720)
    expect(parseDuration('PT45S')).toBe(45)
    expect(parseDuration('P0D')).toBe(0)
    expect(parseDuration('nonsense')).toBe(0)
  })
})

describe('searchVideos', () => {
  it('searches for embeddable videos with the key, then reads durations and views', async () => {
    const f = serve([hit('a'), hit('b')], [detail('a', 'PT10M', '500'), detail('b', 'PT20M', '9000')])
    const out = await searchVideos('Krebs cycle Biology', cfg(f))
    expect(out.map(v => [v.id, v.channel, v.seconds, v.views])).toEqual([['a', 'Chan a', 600, 500], ['b', 'Chan b', 1200, 9000]])
    const calls = (f as unknown as { mock: { calls: [string][] } }).mock.calls.map(c => new URL(String(c[0])))
    expect(calls[0].pathname).toBe('/v3/search')
    expect(calls[0].searchParams.get('key')).toBe('K')
    expect(calls[0].searchParams.get('q')).toBe('Krebs cycle Biology')
    expect(calls[0].searchParams.get('type')).toBe('video')
    expect(calls[0].searchParams.get('safeSearch')).toBe('strict')
    expect(calls[1].pathname).toBe('/v3/videos')
    expect(calls[1].searchParams.get('id')).toBe('a,b')
  })
  it('leaves out live streams, shorts-length clips and very long videos', async () => {
    const f = serve([hit('live', { liveBroadcastContent: 'live' }), hit('short'), hit('long'), hit('ok')], [detail('short', 'PT30S'), detail('long', 'PT5H'), detail('ok', 'PT12M'), detail('live', 'PT10M')])
    expect((await searchVideos('q', cfg(f))).map(v => v.id)).toEqual(['ok'])
  })
  it('leaves out a result with no details, and ignores items without a video id', async () => {
    const f = serve([hit('a'), { id: { channelId: 'c' }, snippet: { title: 'chan' } }], [])
    expect(await searchVideos('q', cfg(f))).toEqual([])
  })
  it('fails when YouTube refuses (quota or a bad key)', async () => {
    const f = vi.fn(async () => json({ error: { message: 'quota' } }, false)) as unknown as typeof fetch
    await expect(searchVideos('q', cfg(f))).rejects.toThrow(/YouTube/)
  })
  it('never puts the key in an error message', async () => {
    const f = vi.fn(async (url: string | URL | Request) => { throw new Error(`failed ${String(url)}`) }) as unknown as typeof fetch
    const err = await searchVideos('q', { key: 'SECRET-KEY', base: 'https://yt.test/v3', fetch: f }).catch(e => e as Error)
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).not.toContain('SECRET-KEY')
  })
})
