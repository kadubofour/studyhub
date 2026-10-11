export type Found = { url: string; title: string; kind: 'video' | 'article' }

export const MAX_FOUND = 6
const MAX_URL = 500
const MAX_TITLE = 200
const VIDEO_HOSTS = new Set(['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'vimeo.com'])
const TRACKING = /^(utm_|fbclid$|gclid$|mc_|ref$|ref_)/i

const bareHost = (host: string) => host.replace(/^www\./, '')

export function kindOf(url: string): 'video' | 'article' {
  try { return VIDEO_HOSTS.has(bareHost(new URL(url).hostname.toLowerCase())) ? 'video' : 'article' } catch { return 'article' }
}

// The same page however it is written: no "www.", tracking parameters, fragment or trailing slash
function identity(u: URL): string {
  const params = [...u.searchParams].filter(([k]) => !TRACKING.test(k)).sort(([a], [b]) => a.localeCompare(b))
  const query = params.map(([k, v]) => `${k}=${v}`).join('&')
  return `${bareHost(u.hostname.toLowerCase())}${u.pathname.replace(/\/+$/, '')}${query ? `?${query}` : ''}`
}

// What the search cited, made safe to show and keep: web addresses only, no repeats, videos first, at most six
export function cleanResources(raw: { url: string; title?: string | null }[]): Found[] {
  const seen = new Set<string>()
  const out: Found[] = []
  for (const r of raw) {
    let u: URL
    try { u = new URL(r.url) } catch { continue }
    if ((u.protocol !== 'http:' && u.protocol !== 'https:') || r.url.length > MAX_URL) continue
    const id = identity(u)
    if (seen.has(id)) continue
    seen.add(id)
    const title = (r.title ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE) || bareHost(u.hostname)
    out.push({ url: r.url, title, kind: kindOf(r.url) })
  }
  return [...out.filter(r => r.kind === 'video'), ...out.filter(r => r.kind === 'article')].slice(0, MAX_FOUND)
}
