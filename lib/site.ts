// The public address of the app. A missing or malformed setting must never crash a page, so it falls back to this computer.
export function siteUrl(): URL {
  try {
    const u = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? '')
    if (u.protocol === 'http:' || u.protocol === 'https:') return u
  } catch { /* fall through */ }
  return new URL('http://localhost:3000')
}
