const SIZE = 84
const STROKE = 9
const R = (SIZE - STROKE) / 2
const C = 2 * Math.PI * R

// The daily focus goal as a ring in the accent. The amount is also given in words.
export function GoalRing({ percent, label }: { percent: number; label: string }) {
  const pct = Math.min(100, Math.max(0, Math.round(percent)))
  return (
    <div className="flex items-center gap-3" role="progressbar" aria-label="Focus goal progress" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-valuetext={label}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden className="shrink-0 -rotate-90">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--line)" strokeWidth={STROKE} />
        <circle data-arc cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--accent-solid)" strokeWidth={STROKE} strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 6px var(--accent-solid))' }}
          strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} className="transition-[stroke-dashoffset] duration-500 motion-reduce:transition-none" />
      </svg>
      <div className="leading-tight">
        <div className="font-display text-2xl font-semibold">{pct}%</div>
        <div className="text-sm text-muted">{label}</div>
      </div>
    </div>
  )
}
