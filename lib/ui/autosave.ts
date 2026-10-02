// 'failed' = the save was rejected for good (e.g. a database rule); retrying won't help
export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error' | 'failed'

const RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000]

// Postgres/PostgREST errors carry a SQLSTATE `code`; class 42 (permissions/syntax), 22 (bad data),
// 23 (constraint) and PostgREST's PGRST1xx/2xx (bad request) won't succeed on retry.
// Network failures (no code) and server errors (5xx, timeouts) are worth retrying.
export function isPermanentSaveError(e: unknown): boolean {
  const code = (e as { code?: unknown })?.code
  return typeof code === 'string' && /^(42|22|23|PGRST[12])/.test(code)
}

export function createAutosaver<T>(
  save: (v: T) => Promise<void>, onStatus: (s: SaveStatus) => void, delayMs = 1000,
) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: { v: T } | null = null
  let inFlight: Promise<void> | null = null
  let failures = 0

  async function drain(): Promise<void> {
    while (pending) {
      const item = pending
      pending = null
      onStatus('saving')
      try {
        await save(item.v)
        failures = 0
      } catch (e) {
        if (isPermanentSaveError(e)) {
          // Keep a newer edit (it may succeed); otherwise give up on this value
          if (!pending) { onStatus('failed'); return }
          continue
        }
        pending = pending ?? item // a newer edit wins over the failed older one
        onStatus('error')
        // Keep retrying on our own, even if the editor has unmounted, until the save lands
        const wait = RETRY_DELAYS_MS[Math.min(failures, RETRY_DELAYS_MS.length - 1)]
        failures++
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => { void flush() }, wait)
        return
      }
    }
    onStatus('saved')
  }

  function flush(): Promise<void> {
    if (timer) { clearTimeout(timer); timer = null }
    if (!inFlight) inFlight = drain().finally(() => { inFlight = null })
    return inFlight
  }

  return {
    update(v: T) {
      pending = { v }
      onStatus('pending')
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { void flush() }, delayMs)
    },
    flush,
    hasPending: () => pending !== null,
  }
}
