// Says text aloud, a piece at a time, in order. Each piece is fetched as soon as it is queued (so the next is ready while one plays), played in turn,
// and the whole queue can be cut off at once: that is how the tutor stops when the student speaks. A piece the server cannot voice is read by the
// browser's own voice instead, so the tutor is never silent.

export type SpeakerIo = {
  /** The audio for one piece, or null when it could not be made */
  fetchAudio: (text: string, signal: AbortSignal) => Promise<Blob | null>
  /** Plays a sound; resolves when it ends, rejects if it cannot play. Calling stop ends it early (resolving). */
  play: (blob: Blob) => { done: Promise<void>; stop: () => void }
  /** The browser's own voice, used when there is no audio */
  say?: (text: string) => { done: Promise<void>; stop: () => void }
}

export interface Speaker {
  /** Adds a piece to the end */
  add(text: string): void
  /** Everything said and queued stops now */
  stop(): void
  /** What is being said now (empty when quiet), for telling the tutor's voice from the student's */
  readonly saying: string
  readonly busy: boolean
  /** Called when the first piece starts, and when the queue runs dry */
  onStart: (() => void) | null
  onIdle: (() => void) | null
}

export function createSpeaker(io: SpeakerIo): Speaker {
  type Item = { text: string; audio: Promise<Blob | null> }
  const queue: Item[] = []
  let control = new AbortController()
  let running = false
  let current: { stop: () => void } | null = null
  let saying = ''
  let generation = 0
  const s: Speaker = {
    onStart: null, onIdle: null,
    get saying() { return saying },
    get busy() { return running || queue.length > 0 },
    add(text) {
      const t = text.trim()
      if (!t) return
      const signal = control.signal
      queue.push({ text: t, audio: io.fetchAudio(t, signal).catch(() => null) })
      if (!running) void run()
    },
    stop() {
      generation++
      control.abort(); control = new AbortController()
      queue.length = 0
      current?.stop(); current = null
      const wasBusy = running
      running = false; saying = ''
      if (wasBusy) s.onIdle?.()
    },
  }
  async function run() {
    running = true
    const mine = generation
    let started = false
    while (queue.length && mine === generation) {
      const item = queue.shift()!
      const blob = await item.audio
      if (mine !== generation) return
      if (!started) { started = true; s.onStart?.() }
      saying = item.text
      try {
        const playing = blob ? io.play(blob) : io.say?.(item.text)
        if (!playing) continue
        current = playing
        await playing.done
      } catch {
        // this piece could not be played: the next one is tried
      }
      current = null
    }
    if (mine !== generation) return
    running = false; saying = ''
    s.onIdle?.()
  }
  return s
}

/** The speaker for a browser: the server's voice through an audio element, the browser's own voice as the fallback */
export function browserSpeakerIo(): SpeakerIo {
  return {
    async fetchAudio(text, signal) {
      const res = await fetch('/api/ai/speak', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }), signal })
      return res.ok ? res.blob() : null
    },
    play(blob) {
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      let finish: () => void = () => {}
      const done = new Promise<void>((resolve, reject) => {
        finish = () => { URL.revokeObjectURL(url); resolve() }
        audio.onended = finish
        audio.onerror = () => { URL.revokeObjectURL(url); reject(new Error('audio')) }
        audio.play().catch(e => { URL.revokeObjectURL(url); reject(e) })
      })
      return { done, stop: () => { audio.pause(); finish() } }
    },
    say(text) {
      const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
      if (!synth) return { done: Promise.resolve(), stop: () => {} }
      const u = new SpeechSynthesisUtterance(text)
      let finish: () => void = () => {}
      const done = new Promise<void>(resolve => { finish = resolve; u.onend = () => resolve(); u.onerror = () => resolve() })
      synth.speak(u)
      return { done, stop: () => { synth.cancel(); finish() } }
    },
  }
}
