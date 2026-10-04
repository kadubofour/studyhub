'use client'
import type { AudioMime } from './time'

export type RecordedPart = { index: number; start: number; duration: number; blob: Blob }
type Recorder = {
  start(timeslice?: number): void; stop(): void; pause(): void; resume(): void
  ondataavailable: ((e: { data: Blob }) => void) | null; onstop: (() => void) | null
}
export type RecorderCtor = new (stream: MediaStream, o: { mimeType: string; audioBitsPerSecond: number }) => Recorder

const TYPES: [string, AudioMime, string][] = [
  ['audio/webm;codecs=opus', 'audio/webm', 'webm'], ['audio/mp4', 'audio/mp4', 'm4a'], ['audio/ogg;codecs=opus', 'audio/ogg', 'ogg'],
]
// Opus in WebM (Chrome, Edge, Firefox), AAC in MP4 (Safari), or Ogg
export function pickAudioType(isSupported: (t: string) => boolean): { mime: AudioMime; recorderType: string; ext: string } | null {
  const hit = TYPES.find(([t]) => isSupported(t))
  return hit ? { recorderType: hit[0], mime: hit[1], ext: hit[2] } : null
}

type Open = { index: number; start: number; end: number; chunks: Blob[]; rec: Recorder; stopped: Promise<RecordedPart> }

// Records in parts of `partSeconds` of recording time: the recorder is restarted for each part
// so every part is a complete audio file. Time is measured with the clock (`now`, in ms), not by
// counting timer ticks, because phones slow or pause timers when the screen is off; the page calls
// tick() every second to change parts on time. Paused time doesn't count.
export function createPartRecorder(o: {
  stream: MediaStream; Ctor: RecorderCtor; recorderType: string; mime: AudioMime; partSeconds: number
  onChunk: (partIndex: number, chunk: Blob) => void // every 5 s: the device's safety copy
  onPart: (part: RecordedPart) => void | Promise<void> // a finished part, to upload
  now?: () => number
}) {
  const now = o.now ?? (() => performance.now())
  let banked = 0 // ms recorded before the current stretch
  let runningSince: number | null = null
  let nextIndex = 0
  let open: Open | null = null
  const pending: Promise<void>[] = []
  // Recording seconds so far, to a tenth of a second
  const elapsed = () => Math.round((banked + (runningSince == null ? 0 : now() - runningSince)) / 100) / 10

  function begin(): Open {
    const rec = new o.Ctor(o.stream, { mimeType: o.recorderType, audioBitsPerSecond: 32000 })
    const at = elapsed()
    // One object: close() sets `end` on it, and onstop reads it from the same object
    const part = { index: nextIndex++, start: at, end: at, chunks: [] as Blob[], rec } as Open
    part.stopped = new Promise<RecordedPart>(resolve => {
      rec.onstop = () => resolve({ index: part.index, start: part.start, duration: Math.round((part.end - part.start) * 10) / 10, blob: new Blob(part.chunks, { type: o.mime }) })
    })
    rec.ondataavailable = e => { if (e.data.size) { part.chunks.push(e.data); o.onChunk(part.index, e.data) } }
    rec.start(5000)
    return part
  }

  function close(part: Open) {
    part.end = elapsed()
    part.rec.stop()
    pending.push(part.stopped.then(p => o.onPart(p)))
  }

  function hold() {
    if (runningSince != null) { banked += now() - runningSince; runningSince = null }
  }

  return {
    start() { runningSince = now(); open = begin() },
    tick() {
      if (!open || runningSince == null) return
      if (elapsed() - open.start >= o.partSeconds) { const old = open; open = begin(); close(old) }
    },
    pause() { hold(); open?.rec.pause() },
    resume() { if (runningSince == null) runningSince = now(); open?.rec.resume() },
    async stop() {
      hold()
      if (open) { close(open); open = null }
      await Promise.all(pending)
    },
    elapsed,
  }
}
