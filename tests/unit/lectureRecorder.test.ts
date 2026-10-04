import { describe, it, expect } from 'vitest'
import { createPartRecorder, pickAudioType, type RecordedPart } from '@/lib/lectures/recorder'

const made: FakeRecorder[] = []
class FakeRecorder {
  state = 'inactive'; ondataavailable: ((e: { data: Blob }) => void) | null = null; onstop: (() => void) | null = null
  constructor(readonly stream: unknown, readonly options: { mimeType: string; audioBitsPerSecond: number }) { made.push(this) }
  start(timeslice?: number) { this.state = 'recording'; this.timeslice = timeslice }
  timeslice?: number
  pause() { this.state = 'paused' }
  resume() { this.state = 'recording' }
  emit(text: string) { this.ondataavailable?.({ data: new Blob([text]) }) }
  stop() { this.state = 'inactive'; this.emit('last'); this.onstop?.() }
}
let clock = 0 // ms, standing in for performance.now()
const setup = (partSeconds = 3) => {
  made.length = 0
  clock = 0
  const chunks: [number, number][] = [], parts: RecordedPart[] = []
  const r = createPartRecorder({
    stream: {} as MediaStream, Ctor: FakeRecorder as never, recorderType: 'audio/webm;codecs=opus', mime: 'audio/webm', partSeconds,
    onChunk: (i, blob) => chunks.push([i, blob.size]), onPart: p => { parts.push(p) }, now: () => clock,
  })
  // One second passes and the page's timer fires
  const step = (ms = 1000) => { clock += ms; r.tick() }
  return { r, chunks, parts, step }
}

describe('pickAudioType', () => {
  it('prefers Opus in WebM, then MP4 (Safari), then Ogg', () => {
    expect(pickAudioType(t => t === 'audio/webm;codecs=opus')).toEqual({ mime: 'audio/webm', recorderType: 'audio/webm;codecs=opus', ext: 'webm' })
    expect(pickAudioType(t => t === 'audio/mp4')).toEqual({ mime: 'audio/mp4', recorderType: 'audio/mp4', ext: 'm4a' })
    expect(pickAudioType(() => false)).toBeNull()
  })
})

describe('createPartRecorder', () => {
  it('records mono-rate 32 kbps audio in 5-second chunks, kept for recovery', () => {
    const { r, chunks } = setup()
    r.start()
    expect(made[0].options).toEqual({ mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 32000 })
    expect(made[0].timeslice).toBe(5000)
    made[0].emit('abc')
    expect(chunks).toEqual([[0, 3]])
  })
  it('starts a new file every part, so each part is complete, timed on the recording clock', async () => {
    const { r, parts, step } = setup(3)
    r.start()
    step(); step(); step() // 3 s: part 0 is full
    expect(made).toHaveLength(2)
    step()
    await r.stop()
    expect(parts.map(p => [p.index, p.start, p.duration])).toEqual([[0, 0, 3], [1, 3, 1]])
    expect(parts[0].blob.type).toBe('audio/webm')
  })
  it('doesn\'t count paused time', async () => {
    const { r, parts, step } = setup(100)
    r.start()
    step()
    r.pause()
    step(); step()
    expect(made[0].state).toBe('paused')
    r.resume()
    step()
    expect(r.elapsed()).toBe(2)
    await r.stop()
    expect(parts[0].duration).toBe(2)
  })
  it('measures real time, so a phone that slows the page\'s timer (screen off) keeps parts and times right', async () => {
    const { r, parts, step } = setup(3)
    r.start()
    step(4500) // the timer fired once in 4.5 s
    expect(r.elapsed()).toBe(4.5)
    expect(made).toHaveLength(2)
    clock += 500
    await r.stop()
    expect(parts.map(p => [p.start, p.duration])).toEqual([[0, 4.5], [4.5, 0.5]])
  })
})
