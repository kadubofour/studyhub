// A small bar chart that is easy on the eye: soft bars, this period a little stronger, a label under each, and the numbers above
// when there are few enough bars to read them. Empty periods are a short quiet line, never a hole.
export type Bar = { key: string; value: number; label: string; tip: string; now?: boolean }

export function MiniBars({ bars, aria, values = false, format = String, height = 128 }: {
  bars: Bar[]; aria: string; values?: boolean; format?: (n: number) => string; height?: number
}) {
  const max = Math.max(1, ...bars.map(b => b.value))
  return (
    <div role="img" aria-label={aria} className="flex items-end gap-1.5" style={{ height: height + 40 }}>
      {bars.map(b => (
        <div key={b.key} title={b.tip} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
          {values && <span className="whitespace-nowrap text-[11px] tabular-nums text-muted">{b.value > 0 ? format(b.value) : ''}</span>}
          <div className="flex w-full max-w-10 items-end justify-center" style={{ height }}>
            <div className="w-full rounded-t-lg"
              style={{ height: b.value > 0 ? `${Math.max(6, (b.value / max) * 100)}%` : 3, background: b.value > 0 ? `color-mix(in srgb, var(--accent-solid) ${b.now ? 78 : 40}%, transparent)` : 'var(--line)', borderRadius: b.value > 0 ? undefined : 9999 }} />
          </div>
          <span className={`whitespace-nowrap text-[10px] ${b.now ? 'font-medium text-fg' : 'text-muted'}`}>{b.label}</span>
        </div>
      ))}
    </div>
  )
}
