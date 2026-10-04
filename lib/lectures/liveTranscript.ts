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
}) {
  let rec: Recognition | null = null
  let running = false
  let lineStart: number | null = null

  function listen() {
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
        if (lineStart == null) lineStart = round(o.now())
        if (result.isFinal) {
          o.onLine({ start: lineStart, end: Math.max(lineStart, round(o.now())), text })
          lineStart = null
        } else {
          interim += (interim ? ' ' : '') + text
        }
      }
      o.onInterim(interim)
    }
    r.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { running = false; o.onBlocked?.() }
    }
    r.onend = () => { if (running && rec === r) listen() }
    r.start()
  }

  return {
    start() { if (running) return; running = true; listen() },
    stop() { running = false; lineStart = null; rec?.stop(); o.onInterim('') },
  }
}
