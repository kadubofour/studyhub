// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'

// A stand-in for the browser's audio: it records what was made and started, so the sounds can be checked without speakers
const made = { sources: 0, started: 0, stopped: 0, oscillators: 0, disconnected: 0, loops: [] as { loop: boolean; rate: number; length: number }[], gains: [] as { value: number; setTargetAtTime: ReturnType<typeof vi.fn> }[], filters: [] as { type: string; frequency: number }[] }
const param = (v = 0) => ({ value: v, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() })
function node(extra: Record<string, unknown> = {}) {
  const n: Record<string, unknown> = { context: { currentTime: 0 }, connect: (to: unknown) => to, disconnect: () => { made.disconnected++ }, ...extra }
  return n
}
const buffer = (channels: number, length: number, sampleRate: number) => {
  const data = Array.from({ length: channels }, () => new Float32Array(length))
  return { numberOfChannels: channels, length, sampleRate, getChannelData: (c: number) => data[c] }
}
const fakeCtx = () => ({
  currentTime: 0, sampleRate: 8000, destination: node(), state: 'running' as string,
  createBuffer: (c: number, len: number, rate: number) => buffer(c, len, rate),
  decodeAudioData: async () => { const b = buffer(1, 8000 * 10, 8000); b.getChannelData(0).fill(0.5); return b },
  createBufferSource: () => {
    made.sources++
    const s = node({ loop: false, buffer: null, playbackRate: param(1), start: () => { made.started++ }, stop: () => { made.stopped++ } })
    made.loops.push({ get loop() { return s.loop as boolean }, get rate() { return (s.playbackRate as { value: number }).value }, get length() { return (s.buffer as { length: number } | null)?.length ?? 0 } })
    return s
  },
  createBiquadFilter: () => { const f = node({ type: '', frequency: param(), Q: param() }); made.filters.push({ get type() { return f.type as string }, get frequency() { return (f.frequency as { value: number }).value } }); return f },
  createGain: () => { const g = param(1); made.gains.push(g); return node({ gain: g }) },
  createOscillator: () => { made.oscillators++; return node({ type: '', frequency: param(), detune: param(), start: () => { made.started++ }, stop: () => { made.stopped++ } }) },
})
let ctx: ReturnType<typeof fakeCtx> | null = null
const primeAudio = vi.fn()
vi.mock('@/lib/focus/alert', () => ({ audioContext: () => ctx, primeAudio: () => primeAudio() }))

// Which sound files exist on the "server"
let files: Record<string, boolean> = {}
const fetchMock = vi.fn(async (url: string) => (files[url] ? { ok: true, arrayBuffer: async () => new ArrayBuffer(8) } : { ok: false, arrayBuffer: async () => new ArrayBuffer(0) }))

import { startAmbient, stopAmbient, setAmbientVolume, ambientPlaying, makeSeamless, resetAmbientCache } from '@/lib/focus/ambient'
import { AmbientPlayer } from '@/components/focus/AmbientPlayer'
import { ambientPrefs, DEFAULT_AMBIENT, parseAmbient, setAmbientPrefs } from '@/lib/focus/ambientPrefs'

const RECORDING = 40_000 // longer than the short noise the made sounds loop, shorter than a recording
const flush = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(0) }) }

beforeEach(() => {
  Object.assign(made, { sources: 0, started: 0, stopped: 0, oscillators: 0, disconnected: 0, loops: [], filters: [], gains: [] })
  ctx = fakeCtx(); primeAudio.mockClear(); window.localStorage.clear(); ambientPrefs.set(DEFAULT_AMBIENT)
  files = {}; fetchMock.mockClear(); vi.stubGlobal('fetch', fetchMock); resetAmbientCache()
  vi.useFakeTimers()
})
afterEach(() => { cleanup(); stopAmbient(); vi.runOnlyPendingTimers(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe('the sounds, made in the browser when there is no recording', () => {
  it.each(['rain', 'sea', 'lofi'] as const)('%s makes sound and says it is playing', async kind => {
    expect(startAmbient(kind, 0.6)).toBe(true)
    expect(ambientPlaying()).toBe(kind)
    await flush()
    expect(made.started).toBeGreaterThan(0)
  })

  it('stopping fades out and then lets every part go', async () => {
    startAmbient('sea', 0.6)
    await flush()
    const started = made.started
    stopAmbient()
    expect(ambientPlaying()).toBeNull()
    expect(made.stopped).toBe(0) // still fading
    vi.advanceTimersByTime(600)
    expect(made.stopped).toBe(started)
    expect(made.disconnected).toBeGreaterThan(0)
  })

  it('a new sound replaces the one playing, and a slow start does not play over the new one', async () => {
    startAmbient('rain', 0.6)
    startAmbient('lofi', 0.6)
    expect(ambientPlaying()).toBe('lofi')
    await flush()
    const rainOnly = made.started
    stopAmbient(); await flush(); vi.advanceTimersByTime(600)
    startAmbient('rain', 0.6); stopAmbient() // started and stopped before its recording arrived
    await flush(); vi.advanceTimersByTime(600)
    expect(made.started).toBe(rainOnly) // nothing from the one that was cancelled
  })

  it('lo-fi keeps playing chords, one after another, and stops when stopped', async () => {
    startAmbient('lofi', 0.6)
    await flush()
    const first = made.oscillators
    vi.advanceTimersByTime(4100)
    expect(made.oscillators).toBeGreaterThan(first)
    stopAmbient(); vi.advanceTimersByTime(600)
    const after = made.oscillators
    vi.advanceTimersByTime(20_000)
    expect(made.oscillators).toBe(after)
  })

  it('says no, without throwing, where the browser has no audio', () => {
    ctx = null
    expect(startAmbient('rain', 0.6)).toBe(false)
    expect(ambientPlaying()).toBeNull()
    expect(() => { setAmbientVolume(0.2); stopAmbient() }).not.toThrow()
  })
})

describe('the recordings', () => {
  it('plays a recording as a seamless loop, in place of the made sound', async () => {
    files['/sounds/lofi.ogg'] = true
    startAmbient('lofi', 0.6)
    await flush()
    expect(fetchMock).toHaveBeenCalledWith('/sounds/lofi.ogg')
    expect(made.oscillators).toBe(0) // no chords made: the recording plays
    expect(made.loops.some(l => l.loop && l.length > RECORDING)).toBe(true)
    // a little shorter than the recording, because its end is blended into its start so the join cannot be heard
    expect(made.loops.find(l => l.loop)!.length).toBeLessThan(8000 * 10)
  })

  it('plays the ocean as it was recorded: its own pitch, nothing taken off it', async () => {
    files['/sounds/sea.ogg'] = true
    startAmbient('sea', 0.6)
    await flush()
    const loop = made.loops.find(l => l.loop && l.length > RECORDING)!
    expect(loop.rate).toBe(1)
    expect(made.filters).toEqual([]) // no filter between the recording and the speakers
  })

  it('does not ask for the same recording twice', async () => {
    files['/sounds/rain.ogg'] = true
    startAmbient('rain', 0.6); await flush(); stopAmbient(); vi.advanceTimersByTime(600)
    startAmbient('rain', 0.6); await flush()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to the made sound when the recording is missing or cannot be read, and asks again next time', async () => {
    startAmbient('rain', 0.6); await flush()
    expect(made.oscillators + made.started).toBeGreaterThan(0)
    expect(made.loops.some(l => l.loop && l.length > RECORDING)).toBe(false)
    stopAmbient(); vi.advanceTimersByTime(600)
    files['/sounds/rain.ogg'] = true // it turns up later
    startAmbient('rain', 0.6); await flush()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(made.loops.some(l => l.loop && l.length > RECORDING)).toBe(true)
  })
})

describe('when the code is loaded again while a sound plays (as when it is edited in development)', () => {
  it('the new copy stops the sound the old copy started, instead of playing over it', async () => {
    startAmbient('sea', 0.6)
    await flush()
    const before = made.stopped
    vi.resetModules()
    const again = await import('@/lib/focus/ambient') // a second copy of the module, with its own variables
    again.startAmbient('rain', 0.6)
    await flush()
    vi.advanceTimersByTime(600)
    expect(made.stopped).toBeGreaterThan(before) // the first sound was stopped, not left running underneath
    expect(again.ambientPlaying()).toBe('rain')
    again.stopAmbient()
  })
})

describe('how loud', () => {
  it('a recording plays at its own level when the slider is full: nothing takes it down, so it sounds as it did when downloaded', async () => {
    files['/sounds/sea.ogg'] = true
    startAmbient('sea', 1)
    await flush()
    const [master, level] = made.gains // the master level, then the recording's own level
    expect(master.setTargetAtTime.mock.calls[0][0]).toBe(1)
    expect(level.value).toBe(1)
  })
  it('the slider scales it, and the made stand-ins are kept quieter than a recording so they are not a shock', async () => {
    startAmbient('rain', 0.5)
    await flush()
    expect(made.gains[0].setTargetAtTime.mock.calls[0][0]).toBe(0.5)
    expect(made.gains[1].value).toBe(0.5) // the stand-in's own level, ahead of its layers
    setAmbientVolume(0.25)
    expect(made.gains[0].setTargetAtTime.mock.calls.at(-1)![0]).toBe(0.25)
  })
})

describe('makeSeamless', () => {
  it('blends the end of a recording into its start so it can loop without a click', () => {
    const c = fakeCtx()
    const src = buffer(1, 1000, 100) as unknown as AudioBuffer
    const d = src.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = i < 500 ? 1 : -1 // a jump halfway, to see what each end holds
    const out = makeSeamless(c as unknown as AudioContext, src, 2) // 2 s at 100 Hz = 200 samples blended
    expect(out.length).toBe(800)
    const o = out.getChannelData(0)
    expect(o[0]).toBeCloseTo(-1, 1) // starts as the old end, so the loop point matches what came before it
    expect(o[199]).toBeCloseTo(1, 1) // and ends the blend as the real start
    expect(o[300]).toBe(1) // then the recording as it was
    expect(o[799]).toBe(-1)
  })
  it('never blends more than a third of a short recording', () => {
    const out = makeSeamless(fakeCtx() as unknown as AudioContext, buffer(2, 300, 100) as unknown as AudioBuffer, 10)
    expect(out.length).toBe(200)
    expect(out.numberOfChannels).toBe(2)
  })
})

describe('while the browser has not yet allowed sound', () => {
  it('does not pile up chords to blast out together at the first tap', async () => {
    ctx = fakeCtx(); ctx.state = 'suspended'
    startAmbient('lofi', 0.6)
    await flush()
    const base = made.oscillators
    vi.advanceTimersByTime(5 * 60_000)
    expect(made.oscillators).toBe(base)
    ctx.state = 'running'
    vi.advanceTimersByTime(12_000)
    expect(made.oscillators).toBeGreaterThan(base)
  })
})

describe('the kept choice', () => {
  it('starts off, and cleans what it finds in storage', () => {
    expect(ambientPrefs.get()).toEqual({ sound: 'off', volume: 0.6 })
    expect(parseAmbient({ sound: 'thunder', volume: 7 })).toEqual({ sound: 'off', volume: 1 })
    expect(parseAmbient({ sound: 'rain', volume: -1 })).toEqual({ sound: 'rain', volume: 0 })
    expect(parseAmbient({ sound: 'sea', volume: 'loud' })).toEqual({ sound: 'sea', volume: 0.6 })
    expect(parseAmbient(null)).toEqual(DEFAULT_AMBIENT)
  })
  it('a Café kept from before the ocean replaced it is simply off', () => {
    expect(parseAmbient({ sound: 'cafe', volume: 0.3 })).toEqual({ sound: 'off', volume: 0.3 })
  })
})

describe('the player in the app layout', () => {
  it('plays what was chosen, changes with it, and stops when it is turned off', async () => {
    render(<AmbientPlayer />)
    expect(ambientPlaying()).toBeNull()
    await act(async () => { setAmbientPrefs({ sound: 'rain' }) })
    expect(ambientPlaying()).toBe('rain')
    await act(async () => { setAmbientPrefs({ sound: 'sea' }) })
    expect(ambientPlaying()).toBe('sea')
    await act(async () => { setAmbientPrefs({ sound: 'off' }) })
    expect(ambientPlaying()).toBeNull()
  })

  it('carries on after a reload, from what was kept, and wakes at the first tap', async () => {
    setAmbientPrefs({ sound: 'lofi', volume: 0.3 })
    render(<AmbientPlayer />)
    expect(ambientPlaying()).toBe('lofi')
    act(() => { document.dispatchEvent(new Event('pointerdown')) })
    expect(primeAudio).toHaveBeenCalledTimes(1)
  })

  it('also wakes at the first key press', () => {
    setAmbientPrefs({ sound: 'rain' })
    render(<AmbientPlayer />)
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' })) })
    expect(primeAudio).toHaveBeenCalledTimes(1)
  })

  it('stops when the player goes away', () => {
    setAmbientPrefs({ sound: 'rain' })
    const { unmount } = render(<AmbientPlayer />)
    unmount()
    expect(ambientPlaying()).toBeNull()
  })
})
