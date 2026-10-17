'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

// Dictation: the browser's own speech recognition turns speech into text as the student talks. Nothing is recorded or sent by the app.
interface Recognition {
  continuous: boolean; interimResults: boolean; lang: string
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void; stop(): void; abort(): void
}
type Ctor = new () => Recognition
const ctor = (): Ctor | null => {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** `onText` gets everything said since dictation started (so far, including words the browser may still change) */
export function useDictation(onText: (spoken: string) => void) {
  const [supported] = useState(() => ctor() !== null)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rec = useRef<Recognition | null>(null)
  const latest = useRef(onText)
  useEffect(() => { latest.current = onText })

  const stop = useCallback(() => { rec.current?.stop() }, [])
  const start = useCallback(() => {
    const C = ctor()
    if (!C || rec.current) return
    const r = new C()
    r.continuous = true; r.interimResults = true; r.lang = navigator.language || 'en-US'
    r.onresult = e => { let spoken = ''; for (let i = 0; i < e.results.length; i++) spoken += e.results[i][0].transcript; latest.current(spoken) }
    r.onerror = e => { if (e.error !== 'no-speech' && e.error !== 'aborted') setError(e.error) }
    r.onend = () => { rec.current = null; setListening(false) }
    rec.current = r; setError(null)
    try { r.start(); setListening(true) } catch { rec.current = null; setError('unavailable') }
  }, [])
  useEffect(() => () => { rec.current?.abort() }, [])
  return { supported, listening, error, start, stop }
}
