'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { speakable, speechChunks } from '@/lib/tutor/speakable'

// Reading replies aloud with the browser's own voices: nothing is sent anywhere and nothing extra is used from the AI allowance.
// One thing is read at a time; `speaking` says which (by the id it was given). `onEnd` runs when it finishes, not when stopped.
export function useSpeech() {
  const [supported] = useState(() => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined')
  const [speaking, setSpeaking] = useState<string | null>(null)
  const run = useRef(0) // each read gets a number, so a stopped read's leftover events are ignored

  const stop = useCallback(() => {
    run.current++
    if (supported) window.speechSynthesis.cancel()
    setSpeaking(null)
  }, [supported])

  const speak = useCallback((id: string, markdown: string, onEnd?: () => void) => {
    if (!supported) return
    window.speechSynthesis.cancel()
    const mine = ++run.current
    const pieces = speechChunks(speakable(markdown))
    if (!pieces.length) { setSpeaking(null); onEnd?.(); return }
    setSpeaking(id)
    const lang = document.documentElement.lang || navigator.language || 'en'
    pieces.forEach((text, i) => {
      const u = new SpeechSynthesisUtterance(text)
      u.lang = lang
      if (i === pieces.length - 1) u.onend = () => { if (run.current === mine) { setSpeaking(null); onEnd?.() } }
      u.onerror = () => { if (run.current === mine) setSpeaking(null) }
      window.speechSynthesis.speak(u)
    })
  }, [supported])

  // Phones only let a page speak after a tap: saying nothing during the tap that turns voice mode on unlocks it for later
  const unlock = useCallback(() => {
    if (supported) window.speechSynthesis.speak(new SpeechSynthesisUtterance(''))
  }, [supported])

  useEffect(() => () => { if (supported) window.speechSynthesis.cancel() }, [supported])
  return { supported, speaking, speak, stop, unlock }
}
