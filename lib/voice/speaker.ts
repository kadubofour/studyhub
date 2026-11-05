// Says text aloud, a piece at a time, in order, in the same voice as a visual lesson. The next pieces are fetched while one plays, and the whole queue can be cut
// off at once: that is how the tutor stops when the student speaks. Sentences that come in while those are being fetched are joined into one piece, because the
// voice is natural across a few sentences said together and resets its tone with every piece; so the first sentence still starts quickly. A piece the server
// cannot voice, even after trying again, is read by the browser's own voice instead, so the tutor is never silent.

const AHEAD = 2 // pieces fetched and waiting at once, so a long reply does not send a burst of requests
const JOIN_UP_TO = 400 // characters in a joined piece, about what a lesson's step says
const LONGEST = 500 // characters in any piece (the server refuses more than 600): a longer sentence is broken where it pauses
const RETRY_MS = 400

/** A sentence too long for one piece, broken at a comma or else a space */
export function splitLong(text: string, max = LONGEST): string[] {
  const out: string[] = []
  let left = text
  while (left.length > max) {
    const head = left.slice(0, max)
    const at = Math.max(head.lastIndexOf(', '), head.lastIndexOf('; '), head.lastIndexOf(': '))
    const cut = at > max / 2 ? at + 1 : head.lastIndexOf(' ') > 0 ? head.lastIndexOf(' ') : max
    out.push(left.slice(0, cut).trim())
    left = left.slice(cut).trim()
  }
  if (left) out.push(left)
  return out
}

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
  const queue: Item[] = [] // being fetched, in order
  const waiting: string[] = [] // not fetched yet
  let control = new AbortController()
  let running = false
  let current: { stop: () => void } | null = null
  let saying = ''
  let generation = 0
  // Starts fetching what is waiting, as far as there is room, with sentences that fit said together
  function fetchNext() {
    while (queue.length < AHEAD && waiting.length) {
      let text = waiting.shift()!
      while (waiting.length && text.length + 1 + waiting[0].length <= JOIN_UP_TO) text += ` ${waiting.shift()}`
      queue.push({ text, audio: io.fetchAudio(text, control.signal).catch(() => null) })
    }
  }
  const s: Speaker = {
    onStart: null, onIdle: null,
    get saying() { return saying },
    get busy() { return running || queue.length > 0 || waiting.length > 0 },
    add(text) {
      const t = text.trim()
      if (!t) return
      waiting.push(...splitLong(t))
      fetchNext()
      if (!running) void run()
    },
    stop() {
      generation++
      control.abort(); control = new AbortController()
      queue.length = 0; waiting.length = 0
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
      fetchNext()
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
    // A failure is tried once more before the browser's voice is used; a piece the server refuses as it stands would only be refused again
    async fetchAudio(text, signal) {
      for (let attempt = 0; ; attempt++) {
        try {
          const res = await fetch('/api/ai/speak', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }), signal })
          if (res.ok) return await res.blob()
          if (attempt > 0 || (res.status < 500 && res.status !== 429)) return null
        } catch (e) {
          if (attempt > 0 || signal.aborted) throw e
        }
        await new Promise(r => setTimeout(r, RETRY_MS))
        if (signal.aborted) return null
      }
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
