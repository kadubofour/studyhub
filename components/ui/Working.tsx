'use client'
import { useEffect, useState } from 'react'

// What the app is busy doing, drawn instead of a spinner and "Processing…": each kind of work has its own small moving picture,
// in the student's colour, with a line saying what is happening. Long work can name its steps, shown one after another, so the
// wait reads as progress. The pictures hold still for anyone who asks for less motion (app/globals.css, .working-*).
export type WorkKind = 'read' | 'scan' | 'write' | 'cards' | 'quiz' | 'check' | 'search' | 'listen' | 'think' | 'load'

const A = 'var(--accent-solid)'
const SOFT = 'color-mix(in srgb, var(--accent-solid) 22%, transparent)'
const LINE = 'color-mix(in srgb, var(--fg) 22%, transparent)'

function Art({ kind }: { kind: WorkKind }) {
  switch (kind) {
    case 'read': // a page, its lines, and a highlighter sweeping down it
      return (
        <svg viewBox="0 0 56 56" className="working-art">
          <rect x="12" y="6" width="32" height="44" rx="4" fill="var(--raised)" stroke={LINE} strokeWidth="1.5" />
          {[14, 20, 26, 32, 38].map((y, i) => <rect key={y} x="17" y={y} width={i % 2 ? 16 : 22} height="2.4" rx="1.2" fill={LINE} />)}
          <rect className="working-sweep" x="14" y="12" width="28" height="6" rx="2" fill={SOFT} />
        </svg>
      )
    case 'scan': // a photo with a beam passing over it
      return (
        <svg viewBox="0 0 56 56" className="working-art">
          <rect x="8" y="10" width="40" height="36" rx="5" fill="var(--raised)" stroke={LINE} strokeWidth="1.5" />
          <circle cx="20" cy="22" r="4" fill={SOFT} /><path d="M12 42 L24 30 L32 37 L38 32 L46 40 L46 42 Z" fill={SOFT} />
          <rect className="working-beam" x="6" y="10" width="44" height="2.5" rx="1.25" fill={A} />
        </svg>
      )
    case 'write': // lines being written, a pen moving along them
      return (
        <svg viewBox="0 0 56 56" className="working-art">
          {[16, 25, 34].map((y, i) => <rect key={y} className="working-ink" style={{ animationDelay: `${i * 0.5}s` }} x="10" y={y} width={i === 2 ? 22 : 34} height="3" rx="1.5" fill={A} />)}
          <g className="working-pen"><path d="M0 0 l8 -8 l3 3 l-8 8 z" fill="var(--fg)" opacity="0.75" /></g>
        </svg>
      )
    case 'cards': // cards being dealt onto a pile
      return (
        <svg viewBox="0 0 56 56" className="working-art">
          {[0, 1, 2].map(i => <rect key={i} className="working-deal" style={{ animationDelay: `${i * 0.45}s` }} x="15" y="14" width="26" height="30" rx="4" fill={i === 2 ? A : 'var(--raised)'} stroke={LINE} strokeWidth="1.5" />)}
        </svg>
      )
    case 'quiz': // a list being ticked off
      return (
        <svg viewBox="0 0 56 56" className="working-art">
          {[14, 26, 38].map((y, i) => (
            <g key={y}>
              <rect x="10" y={y - 4} width="8" height="8" rx="2" fill="none" stroke={LINE} strokeWidth="1.5" />
              <path className="working-tick" style={{ animationDelay: `${i * 0.5}s` }} d={`M11.5 ${y} l2 2 l3.5 -4`} fill="none" stroke={A} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="22" y={y - 1.2} width={i === 1 ? 18 : 24} height="2.4" rx="1.2" fill={LINE} />
            </g>
          ))}
        </svg>
      )
    case 'check': // a tick drawing itself in a circle
      return (
        <svg viewBox="0 0 56 56" className="working-art">
          <circle cx="28" cy="28" r="18" fill="none" stroke={SOFT} strokeWidth="3" />
          <circle className="working-ring" cx="28" cy="28" r="18" fill="none" stroke={A} strokeWidth="3" strokeLinecap="round" />
          <path className="working-tick" d="M20 28.5 l5.5 5.5 l10.5 -11" fill="none" stroke={A} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'search': // a magnifier looking over lines
      return (
        <svg viewBox="0 0 56 56" className="working-art">
          {[16, 24, 32, 40].map((y, i) => <rect key={y} x="9" y={y} width={i % 2 ? 26 : 36} height="2.4" rx="1.2" fill={LINE} />)}
          <g className="working-look"><circle cx="0" cy="0" r="7" fill={SOFT} stroke={A} strokeWidth="2.5" /><path d="M5 5 l6 6" stroke={A} strokeWidth="3" strokeLinecap="round" /></g>
        </svg>
      )
    case 'listen': // a sound wave
      return (
        <svg viewBox="0 0 56 56" className="working-art">
          {[0, 1, 2, 3, 4, 5, 6].map(i => <rect key={i} className="working-wave" style={{ animationDelay: `${i * 0.12}s` }} x={9 + i * 6} y="18" width="3.5" height="20" rx="1.75" fill={A} />)}
        </svg>
      )
    case 'think': // three dots in a speech bubble
      return (
        <svg viewBox="0 0 56 56" className="working-art">
          <path d="M10 14 h36 a5 5 0 0 1 5 5 v14 a5 5 0 0 1 -5 5 h-22 l-8 7 v-7 h-6 a5 5 0 0 1 -5 -5 v-14 a5 5 0 0 1 5 -5 z" fill={SOFT} />
          {[20, 28, 36].map((x, i) => <circle key={x} className="working-dot" style={{ animationDelay: `${i * 0.18}s` }} cx={x} cy="26" r="2.8" fill={A} />)}
        </svg>
      )
    default: // load: three soft dots
      return (
        <svg viewBox="0 0 56 56" className="working-art">
          {[18, 28, 38].map((x, i) => <circle key={x} className="working-dot" style={{ animationDelay: `${i * 0.18}s` }} cx={x} cy="28" r="4" fill={A} />)}
        </svg>
      )
  }
}

/** The step to show: the next one every few seconds, staying on the last */
function useStep(steps: string[] | undefined, every = 2800) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (!steps || steps.length < 2) return
    const t = setInterval(() => setI(n => Math.min(n + 1, steps.length - 1)), every)
    return () => clearInterval(t)
  }, [steps, every])
  return steps?.[i]
}

/**
 * A wait, drawn. `size` "lg" is a panel of its own (reading a file, scanning pages); "sm" sits in a line (a button, a status).
 * `steps` are shown in turn under the label, for a wait that takes a while.
 */
export function Working({ kind, label, steps, size = 'lg', className = '' }: { kind: WorkKind; label: string; steps?: string[]; size?: 'sm' | 'lg'; className?: string }) {
  const step = useStep(steps)
  if (size === 'sm') return (
    <span role="status" className={`inline-flex items-center gap-2 ${className}`}>
      <span aria-hidden className="working size-7 shrink-0"><Art kind={kind} /></span>
      <span>{label}<span aria-hidden className="working-ellipsis" /></span>
    </span>
  )
  return (
    <div role="status" className={`flex flex-col items-center gap-2 text-center ${className}`}>
      <span aria-hidden className="working size-16"><Art kind={kind} /></span>
      <p className="text-sm font-medium">{label}<span aria-hidden className="working-ellipsis" /></p>
      {step && <p key={step} className="working-step text-xs text-muted">{step}</p>}
    </div>
  )
}
