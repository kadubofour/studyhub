'use client'
import type { TranscriptLine } from './time'

type Result = { isFinal: boolean; 0: { transcript: string } }
export type Recognition = {
  continuous: boolean; interimResults: boolean; lang: string
  onresult: ((e: { resultIndex: number; results: ArrayLike<Result> }) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
  start(): void; stop(): void
}
export type RecognitionCtor = new () => Recognition

// Chrome, Edge and Safari have speech recognition (Safari and older Chrome as webkitSpeechRecognition); Firefox doesn't
export function speechRecognition(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const round = (n: number) => Math.round(n * 10) / 10

// The free live transcript. Lines are timed by `now()`, the recording clock in seconds (pauses
// left out). Browsers stop listening after a silence, so recognition restarts while it's running.
export function createLiveTranscriber(o: {
  Ctor: RecognitionCtor; now: () => number; lang?: string
  onLine: (line: TranscriptLine) => void; onInterim: (text: string) => void; onBlocked?: () => void
  /** Why live text isn't coming through ('network', 'audio-capture', 'aborted'…), or null once it is */
  onTrouble?: (reason: string | null) => void
}) {
  let rec: Recognition | null = null
  let running = false
  let lineStart: number | null = null
  // After an error (offline, microphone busy) wait before listening again: 1 s, then 2, 4… up to 30 s
  let failures = 0
  let retry: ReturnType<typeof setTimeout> | null = null
  // Chrome ends a recognition after about a minute (and sometimes just goes quiet without saying
  // so), so each one is replaced after 45 s. Words not yet final when one ends are kept as a line.
  let rotate: ReturnType<typeof setTimeout> | null = null
  let pending = ''
  const ROTATE_AFTER = 45_000
  const clearRotate = () => { if (rotate) { clearTimeout(rotate); rotate = null } }

  function flush() {
    if (!pending) return
    const start = lineStart ?? round(o.now())
    o.onLine({ start, end: Math.max(start, round(o.now())), text: pending })
    pending = ''; lineStart = null; o.onInterim('')
  }

  function listen() {
    retry = null
    const r = new o.Ctor()
    rec = r
    r.continuous = true
    r.interimResults = true
    r.lang = o.lang ?? (typeof navigator !== 'undefined' ? navigator.language : '') ?? 'en-GB'
    r.onresult = e => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i]
        const text = result[0].transcript.trim()
        if (!text) continue
        if (failures) { failures = 0; o.onTrouble?.(null) }
        if (lineStart == null) lineStart = round(o.now())
        if (result.isFinal) {
          o.onLine({ start: lineStart, end: Math.max(lineStart, round(o.now())), text })
          lineStart = null
        } else {
          interim += (interim ? ' ' : '') + text
        }
      }
      pending = interim
      o.onInterim(interim)
    }
    r.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { running = false; o.onBlocked?.() }
      // 'aborted' too: another recognition (another tab) took over; restarting at once would
      // just take it back, and the two would cancel each other forever
      else if (e.error !== 'no-speech') { failures++; o.onTrouble?.(e.error) }
    }
    r.onend = () => {
      if (rec !== r) return
      clearRotate()
      if (!running) return
      flush()
      if (!failures) { attempt(); return }
      later()
    }
    r.start()
    clearRotate()
    rotate = setTimeout(() => {
      rotate = null
      if (!running || rec !== r) return
      // stop() lets the browser deliver what it was hearing, then onend restarts
      try { r.stop() } catch { /* replaced below */ }
      // If it never says it ended, replace it anyway
      setTimeout(() => { if (running && rec === r) { flush(); attempt() } }, 2000)
    }, ROTATE_AFTER)
  }

  const later = () => { retry = setTimeout(() => { if (running) attempt() }, Math.min(30_000, 1000 * 2 ** (failures - 1))) }
  // Browsers cut recognition off every minute or so, and starting again can throw (the old session
  // not quite closed yet). One failed restart must not end the transcript: back off and retry.
  function attempt() {
    try { listen() } catch { failures++; later() }
  }

  return {
    start() { if (running) return; running = true; listen() },
    stop() {
      flush(); clearRotate()
      running = false; lineStart = null; failures = 0
      if (retry) { clearTimeout(retry); retry = null }
      rec?.stop(); o.onInterim('')
    },
  }
}
