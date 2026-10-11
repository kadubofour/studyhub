export type YoutubeConfig = { key: string; base?: string; fetch?: typeof fetch; signal?: AbortSignal }
export type Video = { id: string; title: string; channel: string; seconds: number; views: number }

// Never carries the key or the address: only what an operator needs to see in a log
export class YoutubeError extends Error {
  constructor(public status: number, public reason: string) { super('YouTube could not be searched.') }
}

const BASE = 'https://www.googleapis.com/youtube/v3'
const MIN_SECONDS = 181   // YouTube Shorts run up to three minutes, and shorter clips teach too little
const MAX_SECONDS = 5400  // longer than 90 minutes is a whole lecture
const CANDIDATES = 25     // the same quota cost as 5

// "PT1H2M3S" → seconds; anything unreadable is 0
export function parseDuration(iso: string): number {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso)
  if (!m) return 0
  const [d, h, min, s] = [m[1], m[2], m[3], m[4]].map(x => Number(x ?? 0))
  return d * 86400 + h * 3600 + min * 60 + s
}

type SearchItem = { id?: { videoId?: string }; snippet?: { liveBroadcastContent?: string } }
type DetailItem = {
  id?: string; snippet?: { title?: string; channelTitle?: string }
  contentDetails?: { duration?: string; contentRating?: { ytRating?: string } }; statistics?: { viewCount?: string }
}

// Teaching-length, public, not-live videos for a query. The key travels in a header and never appears in an error.
export async function searchVideos(query: string, cfg: YoutubeConfig): Promise<Video[]> {
  const f = cfg.fetch ?? fetch
  const base = cfg.base ?? BASE
  async function get<T>(path: string, params: Record<string, string>): Promise<T> {
    let res: Response
    try { res = await f(`${base}${path}?${new URLSearchParams(params)}`, { headers: { 'X-Goog-Api-Key': cfg.key }, signal: cfg.signal }) } catch { throw new YoutubeError(0, 'network') }
    if (!res.ok) {
      const body = await res.json().catch(() => null) as { error?: { errors?: { reason?: string }[] } } | null
      throw new YoutubeError(res.status, body?.error?.errors?.[0]?.reason ?? 'unknown')
    }
    return await res.json() as T
  }
  const found = await get<{ items?: SearchItem[] }>('/search', {
    part: 'snippet', type: 'video', q: query, maxResults: String(CANDIDATES), safeSearch: 'strict', relevanceLanguage: 'en',
  })
  const hits = (found.items ?? []).filter(i => i.id?.videoId && i.snippet?.liveBroadcastContent === 'none')
  if (!hits.length) return []
  const ids = hits.map(h => h.id!.videoId!)
  // Titles come from here: search results are HTML-escaped, these are not
  const details = await get<{ items?: DetailItem[] }>('/videos', { part: 'snippet,contentDetails,statistics', id: ids.join(',') })
  const byId = new Map((details.items ?? []).filter(d => d.id).map(d => [d.id!, d]))
  const out: Video[] = []
  for (const id of ids) {
    const d = byId.get(id)
    if (!d || d.contentDetails?.contentRating?.ytRating === 'ytAgeRestricted') continue
    const seconds = parseDuration(d.contentDetails?.duration ?? '')
    if (seconds < MIN_SECONDS || seconds > MAX_SECONDS) continue
    out.push({ id, title: d.snippet?.title ?? '', channel: d.snippet?.channelTitle ?? '', seconds, views: Number(d.statistics?.viewCount ?? 0) })
  }
  return out
}
