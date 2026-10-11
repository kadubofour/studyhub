import { describe, it, expect, vi } from 'vitest'
import { parseDuration, searchVideos, YoutubeError } from '@/lib/youtube'

type Call = { url: URL; headers: Record<string, string> }
const json = (data: unknown, ok = true, status = ok ? 200 : 403) => ({ ok, status, json: async () => data }) as Response
const hit = (id: string, over: object = {}) => ({ id: { videoId: id }, snippet: { liveBroadcastContent: 'none', ...over } })
const detail = (id: string, duration: string, over: { title?: string; channel?: string; views?: string; contentDetails?: object } = {}) => ({
  id, snippet: { title: over.title ?? `Title ${id}`, channelTitle: over.channel ?? `Chan ${id}` },
  contentDetails: { duration, ...(over.contentDetails ?? {}) }, statistics: { viewCount: over.views ?? '1000' },
})
function serve(searchItems: unknown[], details: unknown[]) {
  const calls: Call[] = []
  const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = new URL(String(url))
    calls.push({ url: u, headers: (init?.headers ?? {}) as Record<string, string> })
    return u.pathname.endsWith('/search') ? json({ items: searchItems }) : json({ items: details })
  }) as unknown as typeof fetch
  return { f, calls }
}
const cfg = (f: typeof fetch) => ({ key: 'K', base: 'https://yt.test/v3', fetch: f })

describe('parseDuration', () => {
  it('reads ISO 8601 durations', () => {
    expect(parseDuration('PT15M33S')).toBe(933)
    expect(parseDuration('PT1H2M')).toBe(3720)
    expect(parseDuration('PT45S')).toBe(45)
    expect(parseDuration('P1DT2H')).toBe(93600)
    expect(parseDuration('PT0S')).toBe(0)
    expect(parseDuration('P0D')).toBe(0)
    expect(parseDuration('nonsense')).toBe(0)
  })
})

describe('searchVideos', () => {
  it('searches with the key in a header, then reads titles, channels, durations and views from the details', async () => {
    const { f, calls } = serve([hit('a'), hit('b')], [detail('a', 'PT10M', { views: '500' }), detail('b', 'PT20M', { views: '9000' })])
    const out = await searchVideos('Krebs cycle Biology', cfg(f))
    expect(out.map(v => [v.id, v.title, v.channel, v.seconds, v.views])).toEqual([['a', 'Title a', 'Chan a', 600, 500], ['b', 'Title b', 'Chan b', 1200, 9000]])
    expect(calls[0].url.pathname).toBe('/v3/search')
    expect(calls[0].url.searchParams.get('q')).toBe('Krebs cycle Biology')
    expect(calls[0].url.searchParams.get('type')).toBe('video')
    expect(calls[0].url.searchParams.get('safeSearch')).toBe('strict')
    expect(calls[1].url.pathname).toBe('/v3/videos')
    expect(calls[1].url.searchParams.get('id')).toBe('a,b')
    expect(calls[1].url.searchParams.get('part')).toBe('snippet,contentDetails,statistics')
    for (const c of calls) {
      expect(c.headers['X-Goog-Api-Key']).toBe('K')
      expect(c.url.search).not.toContain('key=')
    }
  })
  it('shows real titles: the details are not HTML-escaped the way search results are', async () => {
    const { f } = serve([hit('a', { title: 'Krebs Cycle &amp; ETC' })], [detail('a', 'PT10M', { title: 'Krebs Cycle & ETC', channel: "Khan Academy's lab" })])
    const [v] = await searchVideos('q', cfg(f))
    expect(v.title).toBe('Krebs Cycle & ETC')
    expect(v.channel).toBe("Khan Academy's lab")
  })
  it('leaves out live streams, clips under three minutes, very long videos and age-restricted videos', async () => {
    const { f } = serve(
      [hit('live', { liveBroadcastContent: 'live' }), hit('upcoming', { liveBroadcastContent: 'upcoming' }), hit('short'), hit('long'), hit('adult'), hit('ok')],
      [detail('short', 'PT2M59S'), detail('long', 'PT5H'), detail('ok', 'PT12M'), detail('live', 'PT10M'), detail('upcoming', 'P0D'),
        detail('adult', 'PT10M', { contentDetails: { contentRating: { ytRating: 'ytAgeRestricted' } } })],
    )
    expect((await searchVideos('q', cfg(f))).map(v => v.id)).toEqual(['ok'])
  })
  it('leaves out a result with no details, and ignores items without a video id', async () => {
    const { f } = serve([hit('a'), { id: { channelId: 'c' }, snippet: { title: 'chan' } }], [])
    expect(await searchVideos('q', cfg(f))).toEqual([])
  })
  it('fails with the status and Google\'s reason when YouTube refuses, without the key', async () => {
    const f = vi.fn(async () => json({ error: { errors: [{ reason: 'quotaExceeded' }] } }, false, 403)) as unknown as typeof fetch
    const err = await searchVideos('q', { key: 'SECRET-KEY', base: 'https://yt.test/v3', fetch: f }).catch(e => e as YoutubeError)
    expect(err).toBeInstanceOf(YoutubeError)
    expect((err as YoutubeError).status).toBe(403)
    expect((err as YoutubeError).reason).toBe('quotaExceeded')
    expect((err as Error).message).not.toContain('SECRET-KEY')
  })
  it('never puts the key in an error message when the network fails', async () => {
    const f = vi.fn(async (url: string | URL | Request) => { throw new Error(`failed ${String(url)} SECRET-KEY`) }) as unknown as typeof fetch
    const err = await searchVideos('q', { key: 'SECRET-KEY', base: 'https://yt.test/v3', fetch: f }).catch(e => e as Error)
    expect(err).toBeInstanceOf(YoutubeError)
    expect((err as Error).message).not.toContain('SECRET-KEY')
  })
})
