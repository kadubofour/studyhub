// Asks the server to draw a PDF's figures again as SVG. Figures arriving together (a note's figures are cut out side by side) travel
// in one request, up to MAX per request, which is one AI action; a failure of any kind gives null, and the figure is kept as cut out.

export type Drawing = { svg: string; width: number; height: number }
export type RedrawFigure = (picture: Blob, caption: string) => Promise<Drawing | null>
type Post = (figures: { image: string; caption: string }[]) => Promise<(Drawing | null)[]>

const MAX = 6
const WINDOW_MS = 120

const toDataUrl = (b: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader()
  r.onload = () => resolve(String(r.result))
  r.onerror = () => reject(r.error)
  r.readAsDataURL(b)
})

const postToServer = (signal?: AbortSignal): Post => async figures => {
  const res = await fetch('/api/ai/redraw-figures', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ figures }), signal })
  if (!res.ok) throw new Error('redraw failed')
  const { drawings } = await res.json() as { drawings: (Drawing | null)[] }
  return drawings
}

/** A redrawer that batches what is asked within a moment; after one failed request it stops asking (a limit or an outage will not clear mid-import) */
export function figureRedrawer(opts: { post?: Post; signal?: AbortSignal; onUsed?: () => void } = {}): RedrawFigure {
  const post = opts.post ?? postToServer(opts.signal)
  let waiting: { image: string; caption: string; done: (d: Drawing | null) => void }[] = []
  let timer: ReturnType<typeof setTimeout> | null = null
  let stopped = false

  async function send(batch: typeof waiting) {
    try {
      const drawings = await post(batch.map(({ image, caption }) => ({ image, caption })))
      opts.onUsed?.()
      batch.forEach((b, i) => b.done(drawings[i] ?? null))
    } catch {
      stopped = true
      batch.forEach(b => b.done(null))
    }
  }
  function flush() {
    timer = null
    const all = waiting; waiting = []
    for (let i = 0; i < all.length; i += MAX) void send(all.slice(i, i + MAX))
  }

  return async (picture, caption) => {
    if (stopped) return null
    const image = await toDataUrl(picture).catch(() => null)
    if (!image) return null
    return new Promise<Drawing | null>(resolve => {
      waiting.push({ image, caption, done: resolve })
      if (waiting.length >= MAX) { if (timer) clearTimeout(timer); flush() } else if (!timer) timer = setTimeout(flush, WINDOW_MS)
    })
  }
}
