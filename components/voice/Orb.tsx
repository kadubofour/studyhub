import type { Phase } from '@/components/voice/useLiveSession'

/** The tutor's voice, drawn as something alive: layers of soft colour that change shape slowly while the student speaks, faster while the tutor does, with a light sweeping round it while it thinks */
export function Orb({ phase, muted = false, size }: { phase: Phase; muted?: boolean; size: number | string }) {
  const busy = phase === 'thinking' || phase === 'drawing'
  return (
    <span className="orb relative grid shrink-0 place-items-center" data-phase={phase} data-muted={muted} style={{ width: size, height: size }} aria-hidden>
      <span className="orb-aura" />
      <span className="orb-blob orb-blob-a" />
      <span className="orb-blob orb-blob-b" />
      <span className="orb-blob orb-blob-c" />
      {busy && <span className="orb-sweep" />}
    </span>
  )
}
