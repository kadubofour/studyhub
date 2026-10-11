export type Found = { url: string; title: string; kind: 'video' | 'article'; channel?: string; seconds?: number }

export const MAX_FOUND = 6
const MAX_URL = 500
const MAX_TITLE = 200
const VIDEO_HOSTS = new Set(['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'vimeo.com', 'player.vimeo.com', 'youtube-nocookie.com'])
// Parameters that only say where a visitor came from, never which page it is
const TRACKING = /^(utm_|fbclid$|gclid$|msclkid$|igshid$|yclid$|mc_cid$|mc_eid$|_hsenc$|_hsmi$|si$|feature$|ref_src$)/i

const bareHost = (host: string) => host.replace(/^www\./, '')

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
  const t = tidy(u)
  const params = [...t.searchParams].sort(([a], [b]) => a.localeCompare(b))
  const query = params.map(([k, v]) => `${k}=${v}`).join('&')
  return `${bareHost(t.hostname.toLowerCase())}${t.pathname.replace(/\/+$/, '')}${query ? `?${query}` : ''}`
}

// What the search cited, made safe to show and keep: web addresses only, tidied, no repeats, videos first, at most six
export function cleanResources(raw: { url: string; title?: string | null }[]): Found[] {
  const seen = new Set<string>()
  const out: Found[] = []
  for (const r of raw) {
    const u = parse(r.url)
    if (!u) continue
    const url = tidy(u).href
    const id = identityOf(url)
    if (!id || url.length > MAX_URL || seen.has(id)) continue
    seen.add(id)
    const title = (r.title ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE) || bareHost(u.hostname)
    out.push({ url, title, kind: kindOf(url) })
  }
  return [...out.filter(r => r.kind === 'video'), ...out.filter(r => r.kind === 'article')].slice(0, MAX_FOUND)
}
