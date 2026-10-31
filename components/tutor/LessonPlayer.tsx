'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Trash2 } from 'lucide-react'
import { BOARD_H, BOARD_W, arrowHead, readingMs, revealedAt, wrapText, type LessonColor, type LessonElement, type LessonScript } from '@/lib/lesson/script'

// A visual lesson: a whiteboard that builds up one step at a time while the voice explains it, with the words as captions.
// Play starts the voice and moves on by itself when each step is spoken; the arrows and dots go to any step, and a step with no
// voice (it could not be loaded) stays for as long as it takes to read.

const STROKE: Record<LessonColor, string> = {
  accent: 'var(--accent-solid)', blue: '#2b6cb0', amber: '#d97706', green: '#16a34a', muted: 'var(--muted)',
}
const fillOf = (c: LessonColor) => `color-mix(in srgb, ${STROKE[c]} 14%, var(--raised))`

function Shape({ el, now, focus, step }: { el: LessonElement; now: boolean; focus: boolean; step: number }) {
  const stroke = STROKE[el.color]
  // shapes glow when the voice points at them; written text gets bolder and takes the colour instead, which stays sharp
  const cls = `${now ? 'lesson-in' : ''} ${focus && el.kind !== 'text' ? 'lesson-focus' : ''}`
  const common = { className: cls, style: { '--c': stroke } as React.CSSProperties, 'data-element': el.id, 'data-step': step }
  const inside = (cx: number, cy: number, w: number, size = 4.4) => {
    const lines = wrapText(el.text, Math.max(6, Math.floor(w / (size * 0.52))))
    return (
      <text x={cx} y={cy - ((lines.length - 1) * size * 1.2) / 2} textAnchor="middle" dominantBaseline="central" fontSize={size} fill="var(--fg)" fontWeight={600}>
        {lines.map((l, i) => <tspan key={i} x={cx} dy={i === 0 ? 0 : size * 1.2}>{l}</tspan>)}
      </text>
    )
  }
  if (el.kind === 'box') return (
    <g {...common}><rect x={el.x} y={el.y} width={el.w} height={el.h} rx={3} fill={fillOf(el.color)} stroke={stroke} strokeWidth={0.7} />{inside(el.x + el.w / 2, el.y + el.h / 2, el.w - 3)}</g>
  )
  if (el.kind === 'circle') return (
    <g {...common}><ellipse cx={el.x + el.w / 2} cy={el.y + el.h / 2} rx={el.w / 2} ry={el.h / 2} fill={fillOf(el.color)} stroke={stroke} strokeWidth={0.7} />{inside(el.x + el.w / 2, el.y + el.h / 2, el.w * 0.78)}</g>
  )
  if (el.kind === 'text') {
    const size = el.h >= 10 ? 6.5 : el.h >= 6 ? 4.6 : 3.6
    return (
      <g {...common}><text x={el.x} y={el.y} textAnchor="middle" dominantBaseline="central" fontSize={size} fontWeight={focus || el.h >= 10 ? 700 : 500}
        fill={focus ? (el.color === 'muted' || el.color === 'accent' ? 'var(--accent-solid)' : stroke) : el.color === 'muted' ? 'var(--muted)' : el.color === 'accent' ? 'var(--fg)' : stroke}>{el.text}</text></g>
    )
  }
  // an arrow: its line draws itself from the start, its head and label come after
  const len = Math.hypot(el.x2 - el.x, el.y2 - el.y)
  const ux = len ? (el.x2 - el.x) / len : 0, uy = len ? (el.y2 - el.y) / len : 0
  const ex = el.x2 - ux * 2.2, ey = el.y2 - uy * 2.2 // the line stops at the head
  return (
    <g {...common}>
      <line className="lesson-line" style={{ '--len': len } as React.CSSProperties} x1={el.x} y1={el.y} x2={ex} y2={ey} stroke={stroke} strokeWidth={1.1} strokeLinecap="round" />
      <polygon className="lesson-head" points={arrowHead(el.x, el.y, el.x2, el.y2)} fill={stroke} />
      {el.text && <text x={(el.x + el.x2) / 2} y={(el.y + el.y2) / 2 - 2.6} textAnchor="middle" fontSize={3.4} fontWeight={600} fill="var(--fg)" className="lesson-label">{el.text}</text>}
    </g>
  )
}

export function LessonPlayer({ script, voices, onDelete }: { script: LessonScript; voices: (string | null)[]; onDelete?: () => void }) {
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [started, setStarted] = useState(false) // played at least once: a pause then says Resume
  const audio = useRef<HTMLAudioElement>(null)
  const last = script.steps.length - 1
  const at = useMemo(() => revealedAt(script), [script])
  const focus = useMemo(() => new Set(script.steps[step].focus), [script, step])

  const next = useCallback(() => { if (step < last) setStep(s => s + 1); else setPlaying(false) }, [step, last])

  // While playing, each step speaks its voice and moves on when it ends; with no voice, after the time it takes to read
  useEffect(() => {
    const a = audio.current
    if (!playing || !a) return
    const url = voices[step]
    if (!url) {
      const t = setTimeout(next, readingMs(script.steps[step].narration))
      return () => clearTimeout(t)
    }
    a.src = url
    a.play().catch(() => setPlaying(false)) // the browser can refuse a start that was not a press
    return () => a.pause()
  }, [playing, step, voices, next, script])

  const go = (to: number) => setStep(Math.max(0, Math.min(last, to)))
  const replay = () => { setStep(0); setPlaying(true) }
  const finished = step === last && !playing

  return (
    <section aria-label={`Lesson: ${script.title}`} className="overflow-hidden rounded-2xl border border-line bg-raised">
      <audio ref={audio} onEnded={next} preload="auto" />
      <div className="flex items-center justify-between gap-2 px-4 pt-3">
        <h3 className="min-w-0 truncate text-sm font-semibold">{script.title}</h3>
        {onDelete && <button type="button" className="btn-ghost !px-2 !py-1 text-muted hover:!text-danger" aria-label="Delete lesson" title="Delete lesson" onClick={onDelete}><Trash2 size={14} aria-hidden /></button>}
      </div>
      <div className="px-3 pb-1 pt-2">
        <svg viewBox={`0 0 ${BOARD_W} ${BOARD_H}`} role="img" aria-label={`The board at step ${step + 1} of ${script.steps.length}`} className="block h-auto w-full rounded-xl bg-bg">
          {script.elements.filter(e => (at.get(e.id) ?? 0) <= step).map(e => (
            <Shape key={e.id} el={e} now={at.get(e.id) === step} focus={focus.has(e.id)} step={at.get(e.id) ?? 0} />
          ))}
        </svg>
      </div>
      <p aria-live="polite" className="min-h-[3.25rem] px-4 py-2 text-[15px] leading-relaxed">{script.steps[step].narration}</p>
      <div className="flex items-center gap-1.5 border-t border-line px-3 py-2">
        <button type="button" className="btn-ghost !px-2" aria-label="Previous step" disabled={step === 0} onClick={() => go(step - 1)}><ChevronLeft size={18} aria-hidden /></button>
        {finished
          ? <button type="button" className="btn-primary !px-3" onClick={replay}><RotateCcw size={15} aria-hidden />Replay</button>
          : <button type="button" className="btn-primary !px-3" onClick={() => { setStarted(true); setPlaying(p => !p) }}>
              {playing ? <Pause size={15} aria-hidden /> : <Play size={15} aria-hidden />}{playing ? 'Pause' : started || step > 0 ? 'Resume' : 'Play'}
            </button>}
        <button type="button" className="btn-ghost !px-2" aria-label="Next step" disabled={step === last} onClick={() => go(step + 1)}><ChevronRight size={18} aria-hidden /></button>
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
