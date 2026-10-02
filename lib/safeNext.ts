// Only allow same-site paths as post-login destinations (blocks open redirects).
export function safeNext(next: string | null | undefined, fallback = '/home'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback
  return next
}
