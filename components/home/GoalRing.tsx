const SIZE = 84
const STROKE = 9
const R = (SIZE - STROKE) / 2
const C = 2 * Math.PI * R

// The daily focus goal as a ring (every look but Paper). The amount is also given in words.
export function GoalRing({ percent, label }: { percent: number; label: string }) {
  const pct = Math.min(100, Math.max(0, Math.round(percent)))
  return (
    // On a phone: the minutes and the percent on one line, the bar the full width under them
    <div className="flex items-center gap-3 max-sm:w-full max-sm:flex-col max-sm:items-stretch max-sm:gap-1.5" role="progressbar" aria-label="Focus goal progress" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-valuetext={label}>
      {/* a slim bar on a phone, the ring on wider screens */}
      <span data-goal-bar aria-hidden className="order-2 block h-2 w-20 shrink-0 overflow-hidden rounded-full bg-white/25 max-sm:w-full sm:hidden"><span className="block h-full rounded-full bg-white" style={{ width: `${pct}%` }} /></span>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden className="hidden sm:block shrink-0 -rotate-90">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="rgb(255 255 255 / 0.28)" strokeWidth={STROKE} />
        <circle data-arc cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="#fff" strokeWidth={STROKE} strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} className="transition-[stroke-dashoffset] duration-500 motion-reduce:transition-none" />
      </svg>
      <div className="leading-tight max-sm:flex max-sm:flex-row-reverse max-sm:items-baseline max-sm:justify-between">
        <div className="text-lg font-semibold max-sm:text-sm sm:text-2xl">{pct}%</div>
        <div className="text-sm opacity-90">{label}</div>
      </div>
    </div>
  )
}
