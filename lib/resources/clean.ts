export type Found = { url: string; title: string; kind: 'video' | 'article'; channel?: string; seconds?: number }

export const MAX_FOUND = 6
const MAX_URL = 500
const MAX_TITLE = 200
const VIDEO_HOSTS = new Set(['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'vimeo.com', 'player.vimeo.com', 'youtube-nocookie.com'])
// Parameters that only say where a visitor came from, never which page it is
const TRACKING = /^(utm_|fbclid$|gclid$|msclkid$|igshid$|yclid$|mc_cid$|mc_eid$|_hsenc$|_hsmi$|si$|feature$|ref_src$)/i

const bareHost = (host: string) => host.replace(/^www\./, '')

// At most n characters, never cutting an emoji or other pair in half
export const cut = (s: string, n: number) => Array.from(s).slice(0, n).join('')

const YT_ID = /^[\w-]{11}$/
// The video id of any YouTube address (watch, youtu.be, embed, shorts), or null
export function youtubeId(raw: string): string | null {
  const u = parse(raw)
  if (!u) return null
  const host = bareHost(u.hostname.toLowerCase())
  let id: string | null = null
  if (host === 'youtu.be') id = u.pathname.split('/')[1] ?? null
  else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
    const [, first, second] = u.pathname.split('/')
    id = first === 'watch' ? u.searchParams.get('v') : first === 'embed' || first === 'shorts' || first === 'live' ? second ?? null : null
  }
  return id && YT_ID.test(id) ? id : null
}

export function kindOf(url: string): 'video' | 'article' {
  try { return VIDEO_HOSTS.has(bareHost(new URL(url).hostname.toLowerCase())) ? 'video' : 'article' } catch { return 'article' }
}

function parse(raw: string): URL | null {
  try {
    const u = new URL(raw.trim())
    return u.protocol === 'http:' || u.protocol === 'https:' ? u : null
  } catch { return null }
}

// The address to keep: no tracking parameters and no fragment
function tidy(u: URL): URL {
  const t = new URL(u.href)
  for (const k of [...t.searchParams.keys()]) if (TRACKING.test(k)) t.searchParams.delete(k)
  t.hash = ''
  return t
}

// The same page however it is written: no "www.", trailing slash, tracking parameters or fragment. null if not a web address.
export function identityOf(raw: string): string | null {
  const u = parse(raw)
  if (!u) return null
  const yt = youtubeId(raw)
  if (yt) return `youtube.com/watch?v=${yt}`
  const t = tidy(u)
  const params = [...t.searchParams].sort(([a], [b]) => a.localeCompare(b))
  const query = params.map(([k, v]) => `${k}=${v}`).join('&')
  return `${bareHost(t.hostname.toLowerCase())}${t.pathname.replace(/\/+$/, '')}${query ? `?${query}` : ''}`
}

// What the search cited, made safe to show and keep: web addresses only, tidied, no repeats, videos first, at most six
export function cleanResources(raw: { url: string; title?: string | null }[], limit = MAX_FOUND): Found[] {
  const seen = new Set<string>()
  const out: Found[] = []
  for (const r of raw) {
    const u = parse(r.url)
    if (!u) continue
    const url = tidy(u).href
    const id = identityOf(url)
    if (!id || url.length > MAX_URL || seen.has(id)) continue
    seen.add(id)
    const title = cut((r.title ?? '').replace(/\s+/g, ' ').trim(), MAX_TITLE) || bareHost(u.hostname)
    out.push({ url, title, kind: kindOf(url) })
  }
  return [...out.filter(r => r.kind === 'video'), ...out.filter(r => r.kind === 'article')].slice(0, limit)
}
