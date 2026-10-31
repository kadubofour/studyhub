'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { recognitionCtor, type Recognition } from '@/components/tutor/useDictation'
import { sendTutorMessage } from '@/lib/tutor/stream'
import { AI_MESSAGES } from '@/components/ai/aiFetch'
import { browserSpeakerIo, createSpeaker, type Speaker } from '@/lib/voice/speaker'
import { forSpeech, isEcho, isSpeech, takeSentences } from '@/lib/voice/speech'
import type { LessonScript } from '@/lib/lesson/script'

// A live voice session with the tutor. It listens all the time (the browser's own speech recognition), sends what the student said once they
// pause, says the reply a sentence at a time as it is written, and stops the moment the student speaks over it or presses the button. With
// the visual explanation on, the reply is also drawn on a board that builds up while each step is spoken.

export type Phase = 'listening' | 'thinking' | 'speaking' | 'drawing'
export const PAUSE_MS = 1400 // quiet this long and the student has finished

export interface LiveState {
  active: boolean
  chatId: string | null
  phase: Phase
  visual: boolean
  fullscreen: boolean
  muted: boolean
  supported: boolean
  you: string // what the student is saying, or just said
  tutor: string // what the tutor is saying, or just said
  script: LessonScript | null
  step: number
  error: string | null
}

const IDLE: LiveState = { active: false, chatId: null, phase: 'listening', visual: false, fullscreen: true, muted: false, supported: true, you: '', tutor: '', script: null, step: 0, error: null }

export function useLiveSession() {
  const [state, setState] = useState<LiveState>(IDLE)
  const patch = useCallback((p: Partial<LiveState> | ((s: LiveState) => Partial<LiveState>)) => setState(s => ({ ...s, ...(typeof p === 'function' ? p(s) : p) })), [])
  const live = useRef(state)
  useEffect(() => { live.current = state })

  const rec = useRef<Recognition | null>(null)
  const speaker = useRef<Speaker | null>(null)
  const turn = useRef(0) // each question is a turn; a newer one cancels the older
  const control = useRef<AbortController | null>(null)
  const pause = useRef<ReturnType<typeof setTimeout> | null>(null)
  const restart = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wanted = useRef(false) // the session is on and the microphone should be too
  const heard = useRef('') // what the recogniser has so far

  const clear = (t: React.MutableRefObject<ReturnType<typeof setTimeout> | null>) => { if (t.current) clearTimeout(t.current); t.current = null }

  // the handlers that listening calls later are read through refs: they are made after it, and each render's are the newest
  const onHeardRef = useRef<(said: string) => void>(() => {})
  const listenRef = useRef<() => void>(() => {})

  // ---- listening ------------------------------------------------------------------------------------------------
  const listen = useCallback(() => {
    const C = recognitionCtor()
    if (!C || !wanted.current || live.current.muted || rec.current) return
    const r = new C()
    r.continuous = true; r.interimResults = true; r.lang = navigator.language || 'en-US'
    r.onresult = e => {
      let said = ''
      for (let i = 0; i < e.results.length; i++) said += e.results[i][0].transcript
      onHeardRef.current(said)
    }
    r.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { wanted.current = false; patch({ muted: true, error: 'The microphone is blocked. Allow it in your browser settings, or type your question.' }) }
    }
    r.onend = () => {
      rec.current = null
      clear(restart)
      if (wanted.current && !live.current.muted) restart.current = setTimeout(() => listenRef.current(), 200)
    }
    rec.current = r
    try { r.start() } catch { rec.current = null }
  }, [patch])
  useEffect(() => { listenRef.current = listen })

  // a clean start: what was heard so far is forgotten (the recogniser restarts itself when it ends)
  const forget = useCallback(() => { heard.current = ''; rec.current?.abort() }, [])

  // ---- a turn ---------------------------------------------------------------------------------------------------
  const cancelTurn = useCallback(() => {
    turn.current++
    control.current?.abort(); control.current = null
    speaker.current?.stop()
  }, [])

  const sayAndWait = useCallback((text: string, id: number) => new Promise<void>(resolve => {
    const sp = speaker.current
    const spoken = forSpeech(text)
    if (!sp || !spoken) { resolve(); return }
    const was = sp.onIdle
    sp.onIdle = () => { sp.onIdle = was; was?.(); resolve() }
    takeSentences(spoken, true).ready.forEach(s => sp.add(s))
    if (id !== turn.current) { sp.onIdle = was; resolve() }
  }), [])

  const runTurn = useCallback(async (text: string) => {
    const chatId = live.current.chatId
    if (!chatId) return
    cancelTurn()
    const id = turn.current
    const ctl = new AbortController()
    control.current = ctl
    const sp = speaker.current!
    const visual = live.current.visual
    patch({ phase: 'thinking', you: text, tutor: '', error: null, ...(visual ? {} : { script: null, step: 0 }) })
    let finished = false // the reply is all in; the turn ends when it is all said too
    const done = () => {
      if (id !== turn.current) return
      patch({ phase: 'listening' })
      window.dispatchEvent(new CustomEvent('studyhub:tutor-changed', { detail: { chatId } }))
    }
    sp.onStart = () => { if (id === turn.current) patch({ phase: 'speaking' }) }
    sp.onIdle = () => { if (id === turn.current && finished && !visual) done() }
    let r: Awaited<ReturnType<typeof sendTutorMessage>>
    try { r = await sendTutorMessage(chatId, text, ctl.signal, undefined, { voice: true }) } catch { return } // cancelled before the reply began
    if (id !== turn.current) return
    if (!r.ok) { patch({ phase: 'listening', error: r.message }); return }
    let reply = '', pending = ''
    try {
      for await (const l of r.lines) {
        if (id !== turn.current) return
        if (l.t === 'delta') {
          reply += l.text
          patch({ tutor: forSpeech(reply) })
          if (!visual) {
            const got = takeSentences(forSpeech(pending + l.text))
            pending = got.rest
            got.ready.forEach(s => sp.add(s))
          } else pending += l.text
        } else if (l.t === 'error') {
          if (!reply.trim()) { patch({ phase: 'listening', error: AI_MESSAGES[l.error] ?? AI_MESSAGES.ai_failed }); return }
        }
      }
    } catch { if (id !== turn.current) return }
    if (id !== turn.current) return
    if (!reply.trim()) { patch({ phase: 'listening', error: AI_MESSAGES.ai_failed }); return }

    if (!visual) {
      takeSentences(forSpeech(pending), true).ready.forEach(s => sp.add(s))
      finished = true
      if (!sp.busy) done()
      return
    }
    // The visual explanation: the reply is drawn, then each step is spoken as it appears. If it cannot be drawn, the reply is spoken instead.
    patch({ phase: 'drawing' })
    let script: LessonScript | null = null
    try {
      const res = await fetch('/api/ai/lesson/live', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal, body: JSON.stringify({ question: text, answer: reply }) })
      if (res.ok) script = ((await res.json()) as { script: LessonScript }).script
    } catch { if (id !== turn.current) return }
    if (id !== turn.current) return
    if (!script) {
      patch({ error: 'I couldn\'t draw that one, so I\'ll just say it.' })
      finished = true
      sp.onIdle = () => { if (id === turn.current) done() }
      takeSentences(forSpeech(reply), true).ready.forEach(s => sp.add(s))
      if (!sp.busy) done()
      return
    }
    patch({ script, step: 0, tutor: '' })
    for (let i = 0; i < script.steps.length; i++) {
      if (id !== turn.current) return
      patch({ step: i, tutor: script.steps[i].narration, phase: 'speaking' })
      await sayAndWait(script.steps[i].narration, id)
    }
    if (id === turn.current) done()
  }, [cancelTurn, patch, sayAndWait])

  // ---- what the microphone hears ----------------------------------------------------------------------------------
  const submit = useCallback((text: string) => {
    clear(pause)
    const said = text.trim()
    if (!said) return
    forget()
    void runTurn(said)
  }, [forget, runTurn])

  function onHeard(said: string) {
    const sp = speaker.current
    const talking = !!sp && sp.busy
    const thinking = live.current.phase === 'thinking' || live.current.phase === 'drawing'
    // the tutor's own voice coming back through the speakers is not the student
    if (talking && isEcho(said, sp.saying)) { forget(); return }
    if ((talking || thinking) && !isSpeech(said)) return
    if (talking || thinking) { cancelTurn(); patch({ phase: 'listening' }) } // the student spoke over the tutor: it stops and listens
    heard.current = said
    patch({ you: said, phase: 'listening' })
    clear(pause)
    pause.current = setTimeout(() => submit(heard.current), PAUSE_MS)
  }

  useEffect(() => { onHeardRef.current = onHeard })

  // ---- what the student does -------------------------------------------------------------------------------------
  const start = useCallback((chatId: string) => {
    const supported = recognitionCtor() !== null
    speaker.current?.stop()
    speaker.current = createSpeaker(browserSpeakerIo())
    wanted.current = true
    heard.current = ''
    setState({ ...IDLE, active: true, chatId, supported })
    live.current = { ...IDLE, active: true, chatId, supported }
    listen()
  }, [listen])

  const end = useCallback(() => {
    wanted.current = false
    clear(pause); clear(restart)
    cancelTurn()
    rec.current?.abort(); rec.current = null
    setState(IDLE); live.current = IDLE
  }, [cancelTurn])

  /** The Ask a question button: the tutor stops and listens; if the student had already said something, it is sent now */
  const ask = useCallback(() => {
    const pendingText = heard.current.trim()
    if (pendingText && live.current.phase === 'listening') { submit(pendingText); return }
    cancelTurn(); forget(); clear(pause)
    patch({ phase: 'listening', you: '', error: null })
    if (live.current.muted) { live.current = { ...live.current, muted: false }; patch({ muted: false }); wanted.current = true; listen() }
  }, [cancelTurn, forget, listen, patch, submit])

  const type = useCallback((text: string) => { submit(text) }, [submit])

  const mute = useCallback((muted: boolean) => {
    patch({ muted })
    live.current = { ...live.current, muted }
    if (muted) { clear(pause); clear(restart); heard.current = ''; rec.current?.abort(); rec.current = null; patch({ you: '' }) }
    else { wanted.current = true; listen() }
  }, [listen, patch])

  const setVisual = useCallback((visual: boolean) => patch(visual ? { visual } : { visual, script: null, step: 0 }), [patch])
  const setFullscreen = useCallback((fullscreen: boolean) => patch({ fullscreen }), [patch])

  useEffect(() => () => { wanted.current = false; clear(pause); clear(restart); rec.current?.abort(); speaker.current?.stop(); control.current?.abort() }, [])

  return { state, start, end, ask, type, mute, setVisual, setFullscreen }
}
