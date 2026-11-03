'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Pause, Play, RotateCcw, Trash2 } from 'lucide-react'
import { useLockScroll } from '@/lib/ui/useLockScroll'
import { BOARD_H, BOARD_W, readingMs, revealedAt, wrapText, type LessonColor, type LessonElement, type LessonScript } from '@/lib/lesson/script'
import { boxStroke, headStroke, lineStroke, ovalStroke } from '@/lib/lesson/penStroke'
import { SPEED_MAX, SPEED_MIN, SPEED_STEP, lessonSpeed, useLessonSpeed } from '@/lib/lesson/speed'

// A visual lesson: a plain page that is marked up one step at a time while the voice explains it, with the words as captions. It looks drawn with
// a note's markup tools: shapes and arrows in pen, and a highlighter over whatever the voice points at.
// Play starts the voice and moves on by itself when each step is spoken; the arrows and dots go to any step, the slider sets the speed,
// and a step with no voice (it could not be loaded) stays for as long as it takes to read.

const PEN: Record<LessonColor, string> = {
  accent: 'var(--pen-red)', blue: 'var(--pen-blue)', amber: 'var(--pen-orange)', green: 'var(--pen-green)', muted: 'var(--muted)',
}

// The highlighter's swipe across some words, centred at cx,cy, drawn along them as the voice comes to them
function Swipe({ cx, cy, width, height }: { cx: number; cy: number; width: number; height: number }) {
  return <line className="lesson-highlight" pathLength={1} x1={cx - width / 2} y1={cy} x2={cx + width / 2} y2={cy} strokeWidth={height} />
}
const textWidth = (text: string, size: number) => text.length * size * 0.55

function Shape({ el, now, focus, step }: { el: LessonElement; now: boolean; focus: boolean; step: number }) {
  const stroke = PEN[el.color]
  const cls = `${now ? 'lesson-in' : ''} ${focus && el.kind !== 'text' ? 'lesson-focus' : ''}`
  const common = { className: cls, style: { '--c': stroke } as React.CSSProperties, 'data-element': el.id, 'data-step': step }
  const pen = { fill: 'none', stroke, strokeWidth: 0.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, pathLength: 1, className: 'lesson-stroke' }
  const inside = (cx: number, cy: number, w: number, size = 4.4) => {
    const lines = wrapText(el.text, Math.max(6, Math.floor(w / (size * 0.62))))
    const swipe = Math.min(w + 1, Math.max(...lines.map(l => textWidth(l, size))) + 3)
    return (
      <>
        {focus && <Swipe cx={cx} cy={cy} width={swipe} height={lines.length * size * 1.2 + 1} />}
        <text className="lesson-writing" x={cx} y={cy - ((lines.length - 1) * size * 1.2) / 2} textAnchor="middle" dominantBaseline="central" fontSize={size} fill="var(--fg)" fontWeight={500}>
          {lines.map((l, i) => <tspan key={i} x={cx} dy={i === 0 ? 0 : size * 1.2}>{l}</tspan>)}
        </text>
      </>
    )
  }
  if (el.kind === 'box') return (
    <g {...common}>
      <path {...pen} d={boxStroke(el.id, el.x, el.y, el.w, el.h)} />
      {inside(el.x + el.w / 2, el.y + el.h / 2, el.w - 3)}
    </g>
  )
  if (el.kind === 'circle') return (
    <g {...common}>
      <path {...pen} d={ovalStroke(el.id, el.x + el.w / 2, el.y + el.h / 2, el.w / 2, el.h / 2)} />
      {inside(el.x + el.w / 2, el.y + el.h / 2, el.w * 0.78)}
    </g>
  )
  if (el.kind === 'text') {
    const size = el.h >= 10 ? 6.5 : el.h >= 6 ? 4.6 : 3.6
    return (
      <g {...common}>
        {focus && <Swipe cx={el.x} cy={el.y} width={textWidth(el.text, size) + 3} height={size * 1.3} />}
        <text className="lesson-writing" x={el.x} y={el.y} textAnchor="middle" dominantBaseline="central" fontSize={size} fontWeight={el.h >= 10 ? 600 : 500}
          fill={focus || el.color === 'accent' ? 'var(--fg)' : el.color === 'muted' ? 'var(--muted)' : stroke}>{el.text}</text>
      </g>
    )
  }
  // an arrow: its line draws itself from the start, its head and label come after
  const lx = (el.x + el.x2) / 2, ly = (el.y + el.y2) / 2 - 2.6
  return (
    <g {...common}>
      <path {...pen} strokeWidth={0.7} d={lineStroke(el.id, el.x, el.y, el.x2, el.y2)} />
      <path className="lesson-head" fill="none" stroke={stroke} strokeWidth={0.7} strokeLinecap="round" strokeLinejoin="round" d={headStroke(el.x, el.y, el.x2, el.y2)} />
      {el.text && focus && <Swipe cx={lx} cy={ly} width={textWidth(el.text, 3.4) + 2} height={4.6} />}
      {el.text && <text className="lesson-writing" x={lx} y={ly} textAnchor="middle" dominantBaseline="central" fontSize={3.4} fontWeight={500} fill="var(--fg)">{el.text}</text>}
    </g>
  )
}

/** The page as it is at a step: everything shown so far, with what the voice points at highlighted */
export function LessonBoard({ script, step, className = 'block h-auto w-full' }: { script: LessonScript; step: number; className?: string }) {
  const at = useMemo(() => revealedAt(script), [script])
  const focus = useMemo(() => new Set(script.steps[step]?.focus ?? []), [script, step])
  return (
    <svg viewBox={`0 0 ${BOARD_W} ${BOARD_H}`} role="img" aria-label={`The board at step ${step + 1} of ${script.steps.length}`} className={`lesson-page ${className}`}>
      {script.elements.filter(e => (at.get(e.id) ?? 0) <= step).map(e => (
        <Shape key={e.id} el={e} now={at.get(e.id) === step} focus={focus.has(e.id)} step={at.get(e.id) ?? 0} />
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
      className={wide ? 'fixed inset-0 z-[85] flex flex-col bg-raised pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]' : 'overflow-hidden rounded-2xl border border-line bg-raised'}>
      <audio ref={audio} onEnded={next} preload="auto" />
      <div className={`flex items-center justify-between gap-2 ${wide ? 'px-5 pt-4' : 'px-4 pt-3'}`}>
        <h3 className={`min-w-0 truncate font-semibold ${wide ? 'text-lg' : 'text-sm'}`}>{script.title}</h3>
        <span className="flex shrink-0 items-center gap-1">
          <button ref={exit} type="button" className="btn-ghost !px-2 text-muted" aria-label={wide ? 'Exit full screen' : 'Full screen'} title={wide ? 'Exit full screen (Esc)' : 'Full screen'} aria-pressed={wide} onClick={() => expand(!wide)}>
            {wide ? <Minimize2 size={wide ? 18 : 14} aria-hidden /> : <Maximize2 size={14} aria-hidden />}
          </button>
        {onDelete && !wide && <button type="button" className="btn-ghost !px-2 !py-1 text-muted hover:!text-danger" aria-label="Delete lesson" title="Delete lesson" onClick={onDelete}><Trash2 size={14} aria-hidden /></button>}
        </span>
      </div>
      <div className={wide ? 'flex min-h-0 flex-1 items-center justify-center px-4 py-2' : 'px-3 pb-1 pt-2'}>
        <LessonBoard script={script} step={step} className={wide ? 'block h-full max-h-full w-full' : undefined} />
      </div>
      <p aria-live="polite" className={wide ? 'mx-auto min-h-[4.5rem] w-full max-w-4xl px-5 py-3 text-lg leading-relaxed md:text-xl' : 'min-h-[3.25rem] px-4 py-2 text-[15px] leading-relaxed'}>{script.steps[step].narration}</p>
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 border-t border-line px-3 py-2">
        <button type="button" className="btn-ghost !px-2" aria-label="Previous step" disabled={step === 0} onClick={() => go(step - 1)}><ChevronLeft size={18} aria-hidden /></button>
        {finished
          ? <button type="button" className="btn-primary !px-3" onClick={replay}><RotateCcw size={15} aria-hidden />Replay</button>
          : <button type="button" className="btn-primary !px-3" onClick={() => { setStarted(true); setPlaying(p => !p) }}>
              {playing ? <Pause size={15} aria-hidden /> : <Play size={15} aria-hidden />}{playing ? 'Pause' : started || step > 0 ? 'Resume' : 'Play'}
            </button>}
        <button type="button" className="btn-ghost !px-2" aria-label="Next step" disabled={step === last} onClick={() => go(step + 1)}><ChevronRight size={18} aria-hidden /></button>
        <label className="order-last flex w-full items-center gap-2.5 px-2 text-sm text-muted sm:order-none sm:ml-3 sm:w-52 sm:px-0">
          <span>Speed</span>
          <input type="range" className="min-w-0 flex-1 cursor-pointer accent-[var(--accent-solid)] pointer-coarse:h-11" min={SPEED_MIN} max={SPEED_MAX} step={SPEED_STEP} value={speed} aria-valuetext={`${speed} times`} onChange={e => lessonSpeed.set(Number(e.target.value))} />
          <output className="w-9 text-right font-semibold tabular-nums text-fg">{speed}×</output>
        </label>
        <div role="group" aria-label="Steps" className="ml-auto flex items-center gap-1">
          {script.steps.map((_, i) => (
            <button key={i} type="button" aria-label={`Step ${i + 1}`} aria-current={i === step ? 'step' : undefined} onClick={() => go(i)}
              className="grid size-5 place-items-center rounded-full"><span className={`block rounded-full transition-all ${i === step ? 'size-2.5 bg-[var(--accent-solid)]' : i < step ? 'size-2 bg-[var(--accent-solid)] opacity-50' : 'size-2 bg-line'}`} /></button>
          ))}
        </div>
      </div>
    </section>
  )
}
