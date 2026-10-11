export type YoutubeConfig = { key: string; base?: string; fetch?: typeof fetch; signal?: AbortSignal }
export type Video = { id: string; title: string; channel: string; seconds: number; views: number }

export class YoutubeError extends Error { constructor() { super('YouTube could not be searched.') } }

const BASE = 'https://www.googleapis.com/youtube/v3'
const MIN_SECONDS = 120   // shorter clips teach too little
const MAX_SECONDS = 5400  // longer than 90 minutes is a whole lecture
const CANDIDATES = 12

// "PT1H2M3S" → seconds; anything unreadable is 0
export function parseDuration(iso: string): number {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso)
  if (!m) return 0
  const [d, h, min, s] = [m[1], m[2], m[3], m[4]].map(x => Number(x ?? 0))
  return d * 86400 + h * 3600 + min * 60 + s
}

type SearchItem = { id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string; liveBroadcastContent?: string } }
type DetailItem = { id?: string; contentDetails?: { duration?: string }; statistics?: { viewCount?: string } }

// Teaching-length, embeddable, not-live videos for a query. The key stays on the server and never appears in an error.
export async function searchVideos(query: string, cfg: YoutubeConfig): Promise<Video[]> {
  const f = cfg.fetch ?? fetch
  const base = cfg.base ?? BASE
  async function get<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = `${base}${path}?${new URLSearchParams({ ...params, key: cfg.key })}`
    let res: Response
    try { res = await f(url, { signal: cfg.signal }) } catch { throw new YoutubeError() }
    if (!res.ok) throw new YoutubeError()
    return await res.json() as T
  }
  const found = await get<{ items?: SearchItem[] }>('/search', {
    part: 'snippet', type: 'video', q: query, maxResults: String(CANDIDATES), safeSearch: 'strict', videoEmbeddable: 'true', relevanceLanguage: 'en',
  })
  const hits = (found.items ?? []).filter(i => i.id?.videoId && i.snippet?.liveBroadcastContent === 'none')
  if (!hits.length) return []
  const ids = hits.map(h => h.id!.videoId!)
  const details = await get<{ items?: DetailItem[] }>('/videos', { part: 'contentDetails,statistics', id: ids.join(',') })
  const byId = new Map((details.items ?? []).filter(d => d.id).map(d => [d.id!, d]))
  const out: Video[] = []
  for (const h of hits) {
    const d = byId.get(h.id!.videoId!)
    if (!d) continue
    const seconds = parseDuration(d.contentDetails?.duration ?? '')
    if (seconds < MIN_SECONDS || seconds > MAX_SECONDS) continue
    out.push({ id: h.id!.videoId!, title: h.snippet?.title ?? '', channel: h.snippet?.channelTitle ?? '', seconds, views: Number(d.statistics?.viewCount ?? 0) })
  }
  return out
}
