// Only allow same-site paths as post-login destinations (blocks open redirects).
// Control characters and backslashes are rejected because browsers strip or rewrite them:
// "/\t/evil.com" would otherwise become "//evil.com".
const UNSAFE = /[\u0000-\u001F\u007F\\]/

export function safeNext(next: string | null | undefined, fallback = '/home'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || UNSAFE.test(next)) return fallback
  try {
    if (new URL(next, 'http://studyhub.local').origin !== 'http://studyhub.local') return fallback
  } catch {
    return fallback
  }
  return next
}
