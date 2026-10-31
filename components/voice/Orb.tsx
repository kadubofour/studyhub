import type { Phase } from '@/components/voice/useLiveSession'

/** The tutor's voice, drawn: it breathes while the student speaks, ripples while the tutor does, and turns while it thinks */
export function Orb({ phase, muted = false, size }: { phase: Phase; muted?: boolean; size: number }) {
  const busy = phase === 'thinking' || phase === 'drawing'
  return (
    <span className="orb relative grid shrink-0 place-items-center" data-phase={phase} data-muted={muted} style={{ width: size, height: size }} aria-hidden>
      <span className="orb-ring absolute inset-[14%] rounded-full border-2 border-[var(--accent-solid)] opacity-0" />
      <span className="orb-ring absolute inset-[14%] rounded-full border-2 border-[var(--accent-solid)] opacity-0" />
      {busy && (
        <svg className="orb-arc absolute inset-0 size-full" viewBox="0 0 100 100" fill="none">
          <circle cx="50" cy="50" r="46" stroke="var(--accent-solid)" strokeWidth="3" strokeLinecap="round" strokeDasharray="70 220" />
        </svg>
      )}
      <span className="orb-core size-[68%] rounded-full shadow-lg" />
    </span>
  )
}
