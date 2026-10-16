import { audioContext } from './alert'
import type { AmbientId } from './ambientPrefs'

// Background sounds made in the browser (Web Audio), so there are no files to ship. They are soft synthetic sounds, not recordings.

type Kind = Exclude<AmbientId, 'off'>
type Stops = (() => void)[]
interface Playing { kind: Kind; master: GainNode; stop: () => void }
let playing: Playing | null = null

const LEVEL = 0.5 // the slider's top is a comfortable level, not the loudest the speakers can do

function noise(ctx: AudioContext, color: 'white' | 'brown', seconds = 4): AudioBufferSourceNode {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1
    if (color === 'white') d[i] = w
    else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5 }
  }
  const src = ctx.createBufferSource()
  src.buffer = buf; src.loop = true
  return src
}

const filter = (ctx: AudioContext, type: BiquadFilterType, frequency: number, q = 0.7) => {
  const f = ctx.createBiquadFilter()
  f.type = type; f.frequency.value = frequency; f.Q.value = q
  return f
}
const gainOf = (ctx: AudioContext, value: number) => { const g = ctx.createGain(); g.gain.value = value; return g }

/** A slow wobble in a level: the sound breathes instead of sitting flat */
function wobble(ctx: AudioContext, target: AudioParam, hz: number, depth: number, stops: Stops) {
  const lfo = ctx.createOscillator(), amount = gainOf(ctx, depth)
  lfo.frequency.value = hz
  lfo.connect(amount); amount.connect(target); lfo.start()
  stops.push(() => lfo.stop())
}

function layer(ctx: AudioContext, out: AudioNode, stops: Stops, color: 'white' | 'brown', level: number, ...filters: BiquadFilterNode[]): GainNode {
  const src = noise(ctx, color), g = gainOf(ctx, level)
  let node: AudioNode = src
  for (const f of filters) node = node.connect(f)
  node.connect(g).connect(out)
  src.start(); stops.push(() => src.stop())
  return g
}

function rain(ctx: AudioContext, out: AudioNode, stops: Stops) {
  const hiss = layer(ctx, out, stops, 'white', 0.35, filter(ctx, 'highpass', 600), filter(ctx, 'lowpass', 7500))
  wobble(ctx, hiss.gain, 0.17, 0.06, stops)
  layer(ctx, out, stops, 'brown', 0.5, filter(ctx, 'lowpass', 420)) // the far, low part of rain
}

function cafe(ctx: AudioContext, out: AudioNode, stops: Stops) {
  const murmur = layer(ctx, out, stops, 'brown', 0.9, filter(ctx, 'bandpass', 520, 0.8))
  wobble(ctx, murmur.gain, 0.31, 0.3, stops) // voices rising and falling
  layer(ctx, out, stops, 'brown', 0.6, filter(ctx, 'lowpass', 260))
  // now and then a cup against a saucer
  let timer: ReturnType<typeof setTimeout>
  const clink = () => {
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain()
    o.type = 'sine'; o.frequency.value = 2200 + Math.random() * 1400
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.4)
    timer = setTimeout(clink, 3000 + Math.random() * 7000)
  }
  timer = setTimeout(clink, 2500)
  stops.push(() => clearTimeout(timer))
}

const CHORDS = [[261.63, 329.63, 392, 493.88], [220, 261.63, 329.63, 392], [174.61, 220, 261.63, 329.63], [196, 246.94, 293.66, 349.23]] // Cmaj7 Am7 Fmaj7 G7
const CHORD_SECONDS = 4

function lofi(ctx: AudioContext, out: AudioNode, stops: Stops) {
  const warm = filter(ctx, 'lowpass', 1100)
  warm.connect(out)
  const pad = gainOf(ctx, 0.5)
  pad.connect(warm)
  let n = 0, timer: ReturnType<typeof setTimeout>
  const play = () => {
    const t = ctx.currentTime
    for (const f of CHORDS[n++ % CHORDS.length]) {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.type = 'triangle'; o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 14 // a little tape drift
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16, t + 0.8); g.gain.linearRampToValueAtTime(0.0001, t + CHORD_SECONDS + 0.6)
      o.connect(g).connect(pad); o.start(t); o.stop(t + CHORD_SECONDS + 0.7)
    }
    timer = setTimeout(play, CHORD_SECONDS * 1000)
  }
  play()
  stops.push(() => clearTimeout(timer))
  const crackle = layer(ctx, out, stops, 'white', 0.018, filter(ctx, 'highpass', 3500)) // the record
  wobble(ctx, crackle.gain, 7, 0.012, stops)
}

const MAKERS: Record<Kind, (ctx: AudioContext, out: AudioNode, stops: Stops) => void> = { rain, cafe, lofi }

/** Starts a sound (replacing the one playing). False when this browser cannot make sound. */
export function startAmbient(kind: Kind, volume: number): boolean {
  stopAmbient()
  try {
    const ctx = audioContext()
    if (!ctx) return false
    const master = ctx.createGain()
    master.gain.value = 0
    master.gain.setTargetAtTime(volume * LEVEL, ctx.currentTime, 0.4) // fades in
    master.connect(ctx.destination)
    const stops: Stops = []
    MAKERS[kind](ctx, master, stops)
    playing = {
      kind, master,
      stop: () => {
        master.gain.setTargetAtTime(0, ctx.currentTime, 0.1)
        setTimeout(() => { stops.forEach(s => { try { s() } catch { /* already stopped */ } }); master.disconnect() }, 500)
      },
    }
    return true
  } catch { return false }
}

export function setAmbientVolume(volume: number) {
  if (!playing) return
  playing.master.gain.setTargetAtTime(volume * LEVEL, playing.master.context.currentTime, 0.05)
}

export function stopAmbient() {
  playing?.stop()
  playing = null
}

export const ambientPlaying = (): Kind | null => playing?.kind ?? null
