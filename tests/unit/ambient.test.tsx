// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'

// A stand-in for the browser's audio: it records what was made and started, so the sounds can be checked without speakers
const made = { sources: 0, started: 0, stopped: 0, oscillators: 0, disconnected: 0 }
const param = () => ({ value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() })
function node(extra: Record<string, unknown> = {}) {
  const n: Record<string, unknown> = { context: { currentTime: 0 }, connect: (to: unknown) => to, disconnect: () => { made.disconnected++ }, ...extra }
  return n
}
const fakeCtx = () => ({
  currentTime: 0, sampleRate: 8000, destination: node(), state: 'running' as string,
  createBuffer: (_c: number, len: number) => ({ getChannelData: () => new Float32Array(len) }),
  createBufferSource: () => { made.sources++; return node({ loop: false, buffer: null, start: () => { made.started++ }, stop: () => { made.stopped++ } }) },
  createBiquadFilter: () => node({ type: '', frequency: param(), Q: param() }),
  createGain: () => node({ gain: param() }),
  createOscillator: () => { made.oscillators++; return node({ type: '', frequency: param(), detune: param(), start: () => { made.started++ }, stop: () => { made.stopped++ } }) },
})
let ctx: ReturnType<typeof fakeCtx> | null = null
const primeAudio = vi.fn()
vi.mock('@/lib/focus/alert', () => ({ audioContext: () => ctx, primeAudio: () => primeAudio() }))

import { startAmbient, stopAmbient, setAmbientVolume, ambientPlaying } from '@/lib/focus/ambient'
import { AmbientPlayer } from '@/components/focus/AmbientPlayer'
import { ambientPrefs, DEFAULT_AMBIENT, parseAmbient, setAmbientPrefs } from '@/lib/focus/ambientPrefs'

beforeEach(() => {
  Object.assign(made, { sources: 0, started: 0, stopped: 0, oscillators: 0, disconnected: 0 })
  ctx = fakeCtx(); primeAudio.mockClear(); window.localStorage.clear(); ambientPrefs.set(DEFAULT_AMBIENT)
  vi.useFakeTimers()
})
afterEach(() => { cleanup(); stopAmbient(); vi.runOnlyPendingTimers(); vi.useRealTimers() })

describe('the sounds', () => {
  it.each(['rain', 'cafe', 'lofi'] as const)('%s makes sound and says it is playing', kind => {
    expect(startAmbient(kind, 0.6)).toBe(true)
    expect(ambientPlaying()).toBe(kind)
    expect(made.started).toBeGreaterThan(0)
  })

  it('stopping fades out and then lets every part go', () => {
    startAmbient('cafe', 0.6)
    const started = made.started
    stopAmbient()
    expect(ambientPlaying()).toBeNull()
    expect(made.stopped).toBe(0) // still fading
    vi.advanceTimersByTime(600)
    expect(made.stopped).toBe(started - (made.started - started)) // everything that began has been stopped
    expect(made.disconnected).toBeGreaterThan(0)
  })

  it('a new sound replaces the one playing', () => {
    startAmbient('rain', 0.6)
    startAmbient('lofi', 0.6)
    expect(ambientPlaying()).toBe('lofi')
  })

  it('lo-fi keeps playing chords, one after another, and café keeps clinking', () => {
    startAmbient('lofi', 0.6)
    const first = made.oscillators
    vi.advanceTimersByTime(4100)
    expect(made.oscillators).toBeGreaterThan(first)
    stopAmbient(); vi.advanceTimersByTime(600)
    const after = made.oscillators
    vi.advanceTimersByTime(20_000)
    expect(made.oscillators).toBe(after) // and stops when stopped
  })

  it('says no, without throwing, where the browser has no audio', () => {
    ctx = null
    expect(startAmbient('rain', 0.6)).toBe(false)
    expect(ambientPlaying()).toBeNull()
    expect(() => { setAmbientVolume(0.2); stopAmbient() }).not.toThrow()
  })
})

describe('while the browser has not yet allowed sound', () => {
  it('does not pile up chords or clinks to blast out together at the first tap', () => {
    for (const kind of ['lofi', 'cafe'] as const) {
      ctx = fakeCtx(); ctx.state = 'suspended'
      startAmbient(kind, 0.6)
      const base = made.oscillators
      vi.advanceTimersByTime(5 * 60_000) // five minutes with nothing tapped
      expect(made.oscillators).toBe(base)
      ctx.state = 'running'
      vi.advanceTimersByTime(12_000)
      expect(made.oscillators).toBeGreaterThan(base) // and it plays once it is allowed
      stopAmbient(); vi.advanceTimersByTime(600)
    }
  })
})

describe('the kept choice', () => {
  it('starts off, and cleans what it finds in storage', () => {
    expect(ambientPrefs.get()).toEqual({ sound: 'off', volume: 0.6 })
    expect(parseAmbient({ sound: 'thunder', volume: 7 })).toEqual({ sound: 'off', volume: 1 })
    expect(parseAmbient({ sound: 'rain', volume: -1 })).toEqual({ sound: 'rain', volume: 0 })
    expect(parseAmbient({ sound: 'cafe', volume: 'loud' })).toEqual({ sound: 'cafe', volume: 0.6 })
    expect(parseAmbient(null)).toEqual(DEFAULT_AMBIENT)
  })
})

describe('the player in the app layout', () => {
  it('plays what was chosen, changes with it, and stops when it is turned off', async () => {
    render(<AmbientPlayer />)
    expect(ambientPlaying()).toBeNull()
    await act(async () => { setAmbientPrefs({ sound: 'rain' }) })
    expect(ambientPlaying()).toBe('rain')
    await act(async () => { setAmbientPrefs({ sound: 'cafe' }) })
    expect(ambientPlaying()).toBe('cafe')
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
