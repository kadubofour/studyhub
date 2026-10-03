'use client'

export const AI_MESSAGES: Record<string, string> = {
  rate_limited: 'You\'re going a bit fast. Try again in a minute.',
  busy: 'Couldn\'t reach the AI. Try again.',
  ai_failed: 'Couldn\'t reach the AI. Try again.',
  ai_unavailable: 'AI isn\'t available right now. Try again later.',
  refused: 'The AI couldn\'t work with this note.',
  too_long: 'This is too long for the AI. Try a shorter note.',
  too_short: 'This note is too short. Add a bit more first.',
  empty: 'The AI couldn\'t find enough in this note to work with.',
  not_found: 'This note no longer exists.',
  unauthorized: 'You\'ve been signed out. Log in again.',
}

// POST to an AI route; errors come back as plain words.
export async function postAi<T>(url: string, body: object, signal?: AbortSignal): Promise<
  { ok: true; value: T } | { ok: false; error: string; message: string }
> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal })
    if (res.ok) return { ok: true, value: await res.json() as T }
    const error = ((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'ai_failed'
    return { ok: false, error, message: AI_MESSAGES[error] ?? AI_MESSAGES.ai_failed }
  } catch (e) {
    if ((e as { name?: string }).name === 'AbortError') throw e
    return { ok: false, error: 'ai_failed', message: AI_MESSAGES.ai_failed }
  }
}
