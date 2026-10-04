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
// so every part is a complete audio file. The page calls tick() every second while recording.
export function createPartRecorder(o: {
  stream: MediaStream; Ctor: RecorderCtor; recorderType: string; mime: AudioMime; partSeconds: number
  onChunk: (partIndex: number, chunk: Blob) => void // every 5 s: the device's safety copy
  onPart: (part: RecordedPart) => void | Promise<void> // a finished part, to upload
}) {
  let elapsed = 0
  let nextIndex = 0
  let paused = false
  let open: Open | null = null
  const pending: Promise<void>[] = []

  function begin(): Open {
    const rec = new o.Ctor(o.stream, { mimeType: o.recorderType, audioBitsPerSecond: 32000 })
    // One object: close() sets `end` on it, and onstop reads it from the same object
    const part = { index: nextIndex++, start: elapsed, end: elapsed, chunks: [] as Blob[], rec } as Open
    part.stopped = new Promise<RecordedPart>(resolve => {
      rec.onstop = () => resolve({ index: part.index, start: part.start, duration: part.end - part.start, blob: new Blob(part.chunks, { type: o.mime }) })
    })
    rec.ondataavailable = e => { if (e.data.size) { part.chunks.push(e.data); o.onChunk(part.index, e.data) } }
    rec.start(5000)
    return part
  }

  function close(part: Open) {
    part.end = elapsed
    part.rec.stop()
    pending.push(part.stopped.then(p => o.onPart(p)))
  }

  return {
    start() { open = begin() },
    tick(seconds = 1) {
      if (!open || paused) return
      elapsed += seconds
      if (elapsed - open.start >= o.partSeconds) { const old = open; open = begin(); close(old) }
    },
    pause() { paused = true; open?.rec.pause() },
    resume() { paused = false; open?.rec.resume() },
    async stop() {
      paused = true
      if (open) { close(open); open = null }
      await Promise.all(pending)
    },
    elapsed: () => elapsed,
  }
}
