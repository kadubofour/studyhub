'use client'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Pause, Play, RotateCcw, Trash2 } from 'lucide-react'
import { useLockScroll } from '@/lib/ui/useLockScroll'
import { BOARD_H, BOARD_W, arrowHead, readingMs, revealedAt, wrapText, type LessonColor, type LessonElement, type LessonScript } from '@/lib/lesson/script'
import { SPEED_MAX, SPEED_MIN, SPEED_STEP, lessonSpeed, useLessonSpeed } from '@/lib/lesson/speed'

// A visual lesson: a chalkboard that is drawn on one step at a time while the voice explains it, with the words as captions.
// Play starts the voice and moves on by itself when each step is spoken; the arrows and dots go to any step, the slider sets the speed,
// and a step with no voice (it could not be loaded) stays for as long as it takes to read.

const CHALK: Record<LessonColor, string> = {
  accent: '#ffb3c6', blue: '#9ad7ff', amber: '#f6d55c', green: '#aee8a4', muted: '#bccbc3',
}
const shadeOf = (c: LessonColor) => `color-mix(in srgb, ${CHALK[c]} 13%, transparent)`

function Shape({ el, now, focus, step, rough }: { el: LessonElement; now: boolean; focus: boolean; step: number; rough: string }) {
  const stroke = CHALK[el.color]
  // shapes glow when the voice points at them; written text gets bolder and takes the colour instead, which stays sharp
  const cls = `${now ? 'lesson-in' : ''} ${focus && el.kind !== 'text' ? 'lesson-focus' : ''}`
  const common = { className: cls, style: { '--c': stroke } as React.CSSProperties, 'data-element': el.id, 'data-step': step }
  const inside = (cx: number, cy: number, w: number, size = 4.6) => {
    const lines = wrapText(el.text, Math.max(6, Math.floor(w / (size * 0.56))))
    return (
      <text className="lesson-hand lesson-writing" x={cx} y={cy - ((lines.length - 1) * size * 1.15) / 2} textAnchor="middle" dominantBaseline="central" fontSize={size} fill="var(--fg)">
        {lines.map((l, i) => <tspan key={i} x={cx} dy={i === 0 ? 0 : size * 1.15}>{l}</tspan>)}
      </text>
    )
  }
  const chalk = { fill: 'none', stroke, strokeWidth: 0.7, strokeLinecap: 'round' as const, pathLength: 1, className: 'lesson-stroke' }
  if (el.kind === 'box') return (
    <g {...common}>
      <rect className="lesson-shade" x={el.x} y={el.y} width={el.w} height={el.h} rx={2} fill={shadeOf(el.color)} />
      <g className="lesson-chalkline"><g filter={`url(#${rough})`}><rect {...chalk} x={el.x} y={el.y} width={el.w} height={el.h} rx={2} /></g></g>
      {inside(el.x + el.w / 2, el.y + el.h / 2, el.w - 3)}
    </g>
  )
  if (el.kind === 'circle') return (
    <g {...common}>
      <ellipse className="lesson-shade" cx={el.x + el.w / 2} cy={el.y + el.h / 2} rx={el.w / 2} ry={el.h / 2} fill={shadeOf(el.color)} />
      <g className="lesson-chalkline"><g filter={`url(#${rough})`}><ellipse {...chalk} cx={el.x + el.w / 2} cy={el.y + el.h / 2} rx={el.w / 2} ry={el.h / 2} /></g></g>
      {inside(el.x + el.w / 2, el.y + el.h / 2, el.w * 0.78)}
    </g>
  )
  if (el.kind === 'text') {
    const size = el.h >= 10 ? 7 : el.h >= 6 ? 5 : 4
    return (
      <g {...common}><text className="lesson-hand lesson-writing" x={el.x} y={el.y} textAnchor="middle" dominantBaseline="central" fontSize={size} fontWeight={focus || el.h >= 10 ? 700 : 400}
        fill={focus && el.color === 'accent' ? CHALK.amber : el.color === 'accent' ? 'var(--fg)' : stroke}>{el.text}</text></g>
    )
  }
  // an arrow: its line draws itself from the start, its head and label come after
  const len = Math.hypot(el.x2 - el.x, el.y2 - el.y)
  const ux = len ? (el.x2 - el.x) / len : 0, uy = len ? (el.y2 - el.y) / len : 0
  const ex = el.x2 - ux * 2.2, ey = el.y2 - uy * 2.2 // the line stops at the head
  return (
    <g {...common}>
      <g className="lesson-chalkline"><g filter={`url(#${rough})`}>
        <line {...chalk} strokeWidth={0.95} x1={el.x} y1={el.y} x2={ex} y2={ey} />
        <polygon className="lesson-head" points={arrowHead(el.x, el.y, el.x2, el.y2)} fill={stroke} />
      </g></g>
      {el.text && <text className="lesson-hand lesson-writing" x={(el.x + el.x2) / 2} y={(el.y + el.y2) / 2 - 2.8} textAnchor="middle" fontSize={3.8} fill="var(--fg)">{el.text}</text>}
    </g>
  )
}

/** The board as it is at a step: everything shown so far, with what the voice points at lit */
export function LessonBoard({ script, step, className = 'block h-auto w-full' }: { script: LessonScript; step: number; className?: string }) {
  const at = useMemo(() => revealedAt(script), [script])
  const focus = useMemo(() => new Set(script.steps[step]?.focus ?? []), [script, step])
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const rough = `chalk-${id}`, dust = `dust-${id}`
  return (
    <svg viewBox={`0 0 ${BOARD_W} ${BOARD_H}`} role="img" aria-label={`The board at step ${step + 1} of ${script.steps.length}`} className={`lesson-chalk overflow-hidden ${className}`}>
      <defs>
        {/* a line drawn by hand, a little unsteady, with the grain of chalk on slate */}
        <filter id={rough} x="-25%" y="-50%" width="150%" height="200%">
          <feTurbulence type="fractalNoise" baseFrequency="0.22" numOctaves={2} seed={4} result="wobble" />
          <feDisplacementMap in="SourceGraphic" in2="wobble" scale={0.9} result="line" />
          <feTurbulence type="fractalNoise" baseFrequency="2.4" numOctaves={2} seed={9} />
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2 2" result="grain" />
          <feComposite in="line" in2="grain" operator="in" />
        </filter>
        {/* what is left of the last lesson, wiped with a cloth */}
        <filter id={dust} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.018 0.05" numOctaves={3} seed={7} />
          <feColorMatrix values="0 0 0 0 0.96  0 0 0 0 0.95  0 0 0 0 0.9  0 0 0 0.16 -0.05" />
        </filter>
      </defs>
      <rect width={BOARD_W} height={BOARD_H} fill="var(--board)" />
      <rect width={BOARD_W} height={BOARD_H} filter={`url(#${dust})`} />
      {script.elements.filter(e => (at.get(e.id) ?? 0) <= step).map(e => (
        <Shape key={e.id} el={e} now={at.get(e.id) === step} focus={focus.has(e.id)} step={at.get(e.id) ?? 0} rough={rough} />
      ))}
    </svg>
  )
}

export function LessonPlayer({ script, voices, onDelete }: { script: LessonScript; voices: (string | null)[]; onDelete?: () => void }) {
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [started, setStarted] = useState(false) // played at least once: a pause then says Resume
  const audio = useRef<HTMLAudioElement>(null)
  const last = script.steps.length - 1

  // A change of speed takes effect at once, without starting the voice again (a new source resets the rate, so each step sets it too)
  const speed = useLessonSpeed()
  const rate = useRef(speed)
  useEffect(() => {
    rate.current = speed
    if (audio.current) { audio.current.defaultPlaybackRate = speed; audio.current.playbackRate = speed }
  }, [speed])

  // Full screen: the browser's own where it has one (the lesson then fills the screen), else the lesson fills the window. It is the same
  // player either way, so the voice carries on without a break. Esc leaves.
  const [wide, setWide] = useState(false)
  useLockScroll(wide) // the page behind a full-screen lesson stays where it was
  const root = useRef<HTMLElement>(null)
  const exit = useRef<HTMLButtonElement>(null)
  function expand(on: boolean) {
    setWide(on)
    if (on) root.current?.requestFullscreen?.().catch(() => {}) // a browser that cannot (an iPhone) keeps the window-filling view
    else if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
  }
  useEffect(() => {
    if (!wide) return
    exit.current?.focus()
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setWide(false) }
    const change = () => { if (!document.fullscreenElement) setWide(false) } // left by the browser's own Esc
    window.addEventListener('keydown', key); document.addEventListener('fullscreenchange', change)
    return () => { window.removeEventListener('keydown', key); document.removeEventListener('fullscreenchange', change) }
  }, [wide])

  const next = useCallback(() => { if (step < last) setStep(s => s + 1); else setPlaying(false) }, [step, last])

  // While playing, each step speaks its voice and moves on when it ends
  useEffect(() => {
    const a = audio.current
    const url = voices[step]
    if (!playing || !a || !url) return
    a.src = url
    a.defaultPlaybackRate = rate.current; a.playbackRate = rate.current
    a.play().catch(() => setPlaying(false)) // the browser can refuse a start that was not a press
    return () => a.pause()
  }, [playing, step, voices])
  // With no voice, it moves on after the time it takes to read, at the lesson's speed
  useEffect(() => {
    if (!playing || voices[step]) return
    const t = setTimeout(next, readingMs(script.steps[step].narration) / speed)
    return () => clearTimeout(t)
  }, [playing, step, voices, next, script, speed])

  const go = (to: number) => setStep(Math.max(0, Math.min(last, to)))
  const replay = () => { setStep(0); setPlaying(true) }
  const finished = step === last && !playing

  return (
    <section ref={root} aria-label={`Lesson: ${script.title}`} role={wide ? 'dialog' : undefined} aria-modal={wide ? true : undefined} data-wide={wide || undefined}
      style={{ '--lesson-speed': speed } as React.CSSProperties}
      className={`lesson-chalk ${wide ? 'fixed inset-0 z-[85] flex flex-col bg-bg pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]' : 'overflow-hidden rounded-2xl bg-bg'}`}>
      <audio ref={audio} onEnded={next} preload="auto" />
      <div className={`flex items-center justify-between gap-2 ${wide ? 'px-5 pt-4' : 'px-4 pt-3'}`}>
        <h3 className={`lesson-hand min-w-0 truncate font-bold ${wide ? 'text-2xl' : 'text-lg'}`}>{script.title}</h3>
        <span className="flex shrink-0 items-center gap-1">
          <button ref={exit} type="button" className="btn-ghost !px-2 text-muted" aria-label={wide ? 'Exit full screen' : 'Full screen'} title={wide ? 'Exit full screen (Esc)' : 'Full screen'} aria-pressed={wide} onClick={() => expand(!wide)}>
            {wide ? <Minimize2 size={wide ? 18 : 14} aria-hidden /> : <Maximize2 size={14} aria-hidden />}
          </button>
        {onDelete && !wide && <button type="button" className="btn-ghost !px-2 !py-1 text-muted hover:!text-danger" aria-label="Delete lesson" title="Delete lesson" onClick={onDelete}><Trash2 size={14} aria-hidden /></button>}
        </span>
      </div>
      <div className={wide ? 'flex min-h-0 flex-1 items-center justify-center' : ''}>
        <LessonBoard script={script} step={step} className={wide ? 'block h-full max-h-full w-full' : undefined} />
      </div>
      <p aria-live="polite" className={wide ? 'mx-auto min-h-[4.5rem] w-full max-w-4xl px-5 py-3 text-lg leading-relaxed md:text-xl' : 'min-h-[3.25rem] px-4 py-2 text-[15px] leading-relaxed'}>{script.steps[step].narration}</p>
      <div className="lesson-tray flex flex-wrap items-center gap-x-1.5 gap-y-1 px-3 py-2">
        <button type="button" className="btn-ghost !px-2 disabled:opacity-40" aria-label="Previous step" disabled={step === 0} onClick={() => go(step - 1)}><ChevronLeft size={18} aria-hidden /></button>
        {finished
          ? <button type="button" className="lesson-play" onClick={replay}><RotateCcw size={15} aria-hidden />Replay</button>
          : <button type="button" className="lesson-play" onClick={() => { setStarted(true); setPlaying(p => !p) }}>
              {playing ? <Pause size={15} aria-hidden /> : <Play size={15} aria-hidden />}{playing ? 'Pause' : started || step > 0 ? 'Resume' : 'Play'}
            </button>}
        <button type="button" className="btn-ghost !px-2 disabled:opacity-40" aria-label="Next step" disabled={step === last} onClick={() => go(step + 1)}><ChevronRight size={18} aria-hidden /></button>
        <label className="lesson-speed order-last flex w-full items-center gap-2.5 px-2 text-sm text-muted sm:order-none sm:ml-3 sm:w-52 sm:px-0">
          <span>Speed</span>
          <input type="range" min={SPEED_MIN} max={SPEED_MAX} step={SPEED_STEP} value={speed} aria-valuetext={`${speed} times`} onChange={e => lessonSpeed.set(Number(e.target.value))} />
          <output className="w-9 text-right font-semibold tabular-nums text-fg">{speed}×</output>
        </label>
        <div role="group" aria-label="Steps" className="ml-auto flex items-center gap-1">
          {script.steps.map((_, i) => (
            <button key={i} type="button" aria-label={`Step ${i + 1}`} aria-current={i === step ? 'step' : undefined} onClick={() => go(i)}
              className="grid size-5 place-items-center rounded-full"><span className={`block rounded-full transition-all ${i === step ? 'size-2.5 bg-fg' : i < step ? 'size-2 bg-fg opacity-50' : 'size-2 bg-line'}`} /></button>
          ))}
        </div>
      </div>
    </section>
  )
}
