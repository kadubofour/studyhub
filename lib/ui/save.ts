export interface SaveOpts {
  apply: () => void
  rollback: () => void
  run: () => Promise<unknown>
  onFail: (retry: () => void) => void
  isOnline?: () => boolean
  onReconnect?: (cb: () => void) => void
}

const defaultOnline = () => typeof navigator === 'undefined' || navigator.onLine
const defaultReconnect = (cb: () => void) => window.addEventListener('online', cb, { once: true })

export async function saveWithRollback(opts: SaveOpts): Promise<void> {
  const isOnline = opts.isOnline ?? defaultOnline
  const onReconnect = opts.onReconnect ?? defaultReconnect
  const retry = () => { void saveWithRollback(opts) }
  opts.apply()
  try {
    await opts.run()
  } catch {
    if (!isOnline()) {
      onReconnect(() => {
        opts.run().catch(() => { opts.rollback(); opts.onFail(retry) })
      })
      return
    }
    opts.rollback()
    opts.onFail(retry)
  }
}
