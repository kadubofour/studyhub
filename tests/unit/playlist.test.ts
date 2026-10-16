import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CROSSFADE, pickNext, startPlaylist } from '@/lib/focus/playlist'

// A stand-in for an <audio> element, driven by the test
class FakeEl {
  src = ''; currentTime = 0; duration = NaN; paused = true; removed = false
  private listeners = new Map<string, Set<() => void>>()
  playError: Error | null = null
  plays = 0
  play = vi.fn(async () => { if (this.playError) throw this.playError; this.paused = false; this.plays++ })
  pause = () => { this.paused = true }
  load = () => {}
  removeAttribute = (n: string) => { if (n === 'src') { this.src = ''; this.removed = true } }
  addEventListener(t: string, f: () => void) { (this.listeners.get(t) ?? this.listeners.set(t, new Set()).get(t)!).add(f) }
  removeEventListener(t: string, f: () => void) { this.listeners.get(t)?.delete(f) }
  fire(t: string) { this.listeners.get(t)?.forEach(f => f()) }
  listenerCount() { return [...this.listeners.values()].reduce((n, s) => n + s.size, 0) }
}
const param = () => ({ value: 0, calls: [] as [string, number, number?][],
  cancelScheduledValues(t: number) { this.calls.push(['cancel', t]) }, setValueAtTime(v: number, t: number) { this.calls.push(['set', v, t]); this.value = v },
  linearRampToValueAtTime(v: number, t: number) { this.calls.push(['ramp', v, t]) } })
type Param = ReturnType<typeof param>
const gains: Param[] = []
const ctxOf = () => ({
  currentTime: 100, state: 'running',
  createGain: () => { const g = param(); gains.push(g); return { gain: g, connect: (to: unknown) => to, disconnect: vi.fn() } },
  createMediaElementSource: () => ({ connect: (to: unknown) => to, disconnect: vi.fn() }),
}) as unknown as AudioContext

let els: FakeEl[] = []
const make = () => { const e = new FakeEl(); els.push(e); return e as unknown as HTMLAudioElement }
const TRACKS = ['/a.ogg', '/b.ogg', '/c.ogg']
const out = { connect: () => out } as unknown as AudioNode
const tick = async () => { await vi.advanceTimersByTimeAsync(0) }

beforeEach(() => { els = []; gains.length = 0; vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('pickNext', () => {
  it('never picks the track that just played, when there is a choice', () => {
    for (let i = 0; i < 200; i++) expect(pickNext(TRACKS, '/b.ogg')).not.toBe('/b.ogg')
  })
  it('can pick any of the others, and starts with any track', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 300; i++) seen.add(pickNext(TRACKS, '/a.ogg'))
    expect([...seen].sort()).toEqual(['/b.ogg', '/c.ogg'])
    const first = new Set<string>()
    for (let i = 0; i < 300; i++) first.add(pickNext(TRACKS, null))
    expect(first.size).toBe(3)
  })
  it('plays the one track again when it is the only one', () => {
    expect(pickNext(['/a.ogg'], '/a.ogg')).toBe('/a.ogg')
  })
})

describe('startPlaylist', () => {
  it('starts one track, and does not load the others yet', async () => {
    startPlaylist(ctxOf(), out, TRACKS, { make, onFail: vi.fn() })
    await tick()
    const playing = els.filter(e => e.plays > 0)
    expect(playing).toHaveLength(1)
    expect(TRACKS).toContain(playing[0].src)
    expect(els.filter(e => e.src !== '')).toHaveLength(1)
  })

  it('fades into the next track, a different one, as the current one nears its end', async () => {
    startPlaylist(ctxOf(), out, TRACKS, { make, onFail: vi.fn() })
    await tick()
    const first = els.find(e => e.plays > 0)!
    first.duration = 120
    first.currentTime = 60
    first.fire('timeupdate')
    expect(els.filter(e => e.plays > 0)).toHaveLength(1) // not yet
    first.currentTime = 120 - CROSSFADE
    first.fire('timeupdate')
    await tick()
    const second = els.find(e => e !== first && e.plays > 0)!
    expect(second).toBeTruthy()
    expect(second.src).not.toBe(first.src)
    // the old one fades down to nothing over the crossfade, and the new one fades up
    const ramps = gains.flatMap(g => g.calls.filter(c => c[0] === 'ramp'))
    expect(ramps.some(c => c[1] === 0 && c[2] === 100 + CROSSFADE)).toBe(true)
    expect(ramps.some(c => c[1] === 1 && c[2] === 100 + CROSSFADE)).toBe(true)
    await vi.advanceTimersByTimeAsync((CROSSFADE + 1) * 1000)
    expect(first.paused).toBe(true) // and the old one is let go once it has faded
    expect(second.paused).toBe(false)
  })

  it('crossfades only once per track', async () => {
    startPlaylist(ctxOf(), out, TRACKS, { make, onFail: vi.fn() })
    await tick()
    const first = els.find(e => e.plays > 0)!
    first.duration = 120; first.currentTime = 118
    for (let i = 0; i < 6; i++) first.fire('timeupdate')
    await tick()
    expect(els.filter(e => e.plays > 0)).toHaveLength(2)
  })

  it('goes straight to the next track when one ends without a crossfade (a very short track)', async () => {
    startPlaylist(ctxOf(), out, TRACKS, { make, onFail: vi.fn() })
    await tick()
    const first = els.find(e => e.plays > 0)!
    first.duration = 5; first.currentTime = 5
    first.fire('timeupdate') // too short to blend: nothing yet
    expect(els.filter(e => e.plays > 0)).toHaveLength(1)
    first.fire('ended')
    await tick()
    expect(els.filter(e => e.plays > 0)).toHaveLength(2)
  })

  it('keeps going through the whole list, never repeating a track straight away', async () => {
    startPlaylist(ctxOf(), out, TRACKS, { make, onFail: vi.fn() })
    await tick()
    let cur = els.find(e => e.plays > 0)!
    const order = [cur.src]
    for (let i = 0; i < 12; i++) {
      cur.duration = 100; cur.currentTime = 100 - CROSSFADE
      cur.fire('timeupdate'); await tick()
      const next = els.find(e => e !== cur)! // two elements take turns
      await vi.advanceTimersByTimeAsync((CROSSFADE + 1) * 1000)
      order.push(next.src); cur = next
    }
    for (let i = 1; i < order.length; i++) expect(order[i]).not.toBe(order[i - 1])
    expect(new Set(order).size).toBe(3)
  })

  it('tells the caller when the first track cannot be loaded, so a stand-in can play', async () => {
    const onFail = vi.fn()
    startPlaylist(ctxOf(), out, TRACKS, { make, onFail })
    await tick()
    els.find(e => e.plays > 0)!.fire('error')
    expect(onFail).toHaveBeenCalledTimes(1)
  })

  it('skips a track that cannot be loaded later on, and carries on', async () => {
    const onFail = vi.fn()
    startPlaylist(ctxOf(), out, TRACKS, { make, onFail })
    await tick()
    const first = els.find(e => e.plays > 0)!
    first.fire('playing')
    first.duration = 100; first.currentTime = 100 - CROSSFADE
    first.fire('timeupdate'); await tick()
    const second = els.find(e => e !== first && e.plays > 0)!
    second.fire('error') // the next one is missing
    await tick()
    expect(onFail).not.toHaveBeenCalled()
    expect(els.reduce((n, e) => n + e.plays, 0)).toBeGreaterThan(2) // another track was started
  })

  it('waits for a tap when the browser will not start it yet, and starts then', async () => {
    const e0 = new FakeEl(); e0.playError = Object.assign(new Error('blocked'), { name: 'NotAllowedError' })
    const made = [e0 as unknown as HTMLAudioElement, new FakeEl() as unknown as HTMLAudioElement]
    let i = 0
    const doc = new EventTarget()
    vi.stubGlobal('document', doc)
    startPlaylist(ctxOf(), out, TRACKS, { make: () => made[i++ % 2], onFail: vi.fn() })
    await tick()
    expect(e0.plays).toBe(0)
    e0.playError = null
    doc.dispatchEvent(new Event('pointerdown'))
    await tick()
    expect(e0.plays).toBe(1)
    vi.unstubAllGlobals()
  })

  it('stopping pauses everything, lets go of the tracks, and leaves nothing listening', async () => {
    const stop = startPlaylist(ctxOf(), out, TRACKS, { make, onFail: vi.fn() })
    await tick()
    const first = els.find(e => e.plays > 0)!
    first.duration = 100; first.currentTime = 100 - CROSSFADE
    first.fire('timeupdate'); await tick()
    stop()
    expect(els.every(e => e.paused)).toBe(true)
    expect(els.every(e => e.src === '')).toBe(true)
    expect(els.every(e => e.listenerCount() === 0)).toBe(true)
    // a late event or timer after stopping does nothing
    first.fire('ended'); await vi.advanceTimersByTimeAsync(10_000)
    expect(els.filter(e => e.plays > 0)).toHaveLength(2)
  })

  it('a single track plays again and again', async () => {
    startPlaylist(ctxOf(), out, ['/only.ogg'], { make, onFail: vi.fn() })
    await tick()
    const first = els.find(e => e.plays > 0)!
    first.duration = 100; first.currentTime = 100 - CROSSFADE
    first.fire('timeupdate'); await tick()
    expect(els.filter(e => e.plays > 0 && e.src === '/only.ogg')).toHaveLength(2)
  })
})
