import 'server-only'
import { after } from 'next/server'

// The tutor replies still being written, by student and chat, so Stop can end one. A reply is not tied to the page it was asked from: it carries on
// when the student goes to another page or closes the tab, and is saved for them to find when they come back. Only Stop ends it early.
// Kept in this server's memory: if Stop reaches another server, that reply is written in full and saved, which is the safe way to be wrong.
const runs = new Map<string, AbortController>()
const keyOf = (userId: string, chatId: string) => `${userId}:${chatId}`

export function startRun(userId: string, chatId: string): { signal: AbortSignal; end: () => void } {
  const key = keyOf(userId, chatId)
  const control = new AbortController()
  runs.set(key, control)
  return { signal: control.signal, end: () => { if (runs.get(key) === control) runs.delete(key) } }
}

/** Ends the reply being written for this chat, if this server is writing it. Whether there was one to end. */
export function stopRun(userId: string, chatId: string): boolean {
  const control = runs.get(keyOf(userId, chatId))
  if (!control) return false
  control.abort()
  return true
}

/** Keeps the work going after the response is over (on a host that ends a request when the browser leaves), up to the route's maxDuration.
 *  Outside a request (in a test) there is nothing to keep alive. */
export function keepAlive(work: Promise<unknown>) {
  try { after(() => work) } catch { /* not in a request */ }
}
