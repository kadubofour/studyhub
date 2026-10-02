export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

const RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000]

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
      } catch {
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
