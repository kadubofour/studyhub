import { audioContext } from './alert'
import type { AmbientId } from './ambientPrefs'

// Background sounds. Each plays a recording from public/sounds when there is one (a seamless loop), and otherwise makes a soft stand-in in the browser
// (Web Audio), so the buttons always do something. See public/sounds/README.md for where the recordings come from.

type Kind = Exclude<AmbientId, 'off'>
type Stops = (() => void)[]
interface Playing { kind: Kind; master: GainNode; stop: () => void }
let playing: Playing | null = null
let token = 0 // each start takes the next number; a recording that arrives for an older one is dropped

const STAND_IN = 0.5 // the made sounds are noise and tones at full scale, so they sit lower than a recording

/** How each recording is played: slower is lower in pitch, a low-pass takes the brightness off, and the blend hides the loop point */
const FILES: Record<Kind, { src: string; rate: number; lowpass: number | null; gain: number; blend: number }> = {
  rain: { src: '/sounds/rain.ogg', rate: 1, lowpass: null, gain: 0.8, blend: 3 }, // steady hiss sounds louder than waves at the same level
  sea: { src: '/sounds/sea.ogg', rate: 1, lowpass: null, gain: 1, blend: 3 },
  lofi: { src: '/sounds/lofi.ogg', rate: 1, lowpass: null, gain: 0.5, blend: 2 }, // music is heard louder than waves at the same level, so it sits lower
}

/**
 * The same recording with its last few seconds blended into its first, so that when it starts over there is no click and no gap: the end of the new
 * version runs straight into what came before its start. A little shorter than the original.
 */
export function makeSeamless(ctx: AudioContext, buf: AudioBuffer, seconds: number): AudioBuffer {
  const n = Math.min(Math.floor(seconds * buf.sampleRate), Math.floor(buf.length / 3))
  const tail = buf.length - n
  const out = ctx.createBuffer(buf.numberOfChannels, tail, buf.sampleRate)
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const from = buf.getChannelData(c), to = out.getChannelData(c)
    to.set(from.subarray(0, tail))
    for (let i = 0; i < n; i++) {
      const t = (i / n) * (Math.PI / 2) // equal power: the blend does not dip in loudness
      to[i] = from[tail + i] * Math.cos(t) + from[i] * Math.sin(t)
    }
  }
  return out
}

const recordings = new Map<Kind, Promise<AudioBuffer | null>>()
export const resetAmbientCache = () => recordings.clear()

function recording(ctx: AudioContext, kind: Kind): Promise<AudioBuffer | null> {
  let p = recordings.get(kind)
  if (!p) {
    const f = FILES[kind]
    p = fetch(f.src)
      .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('missing'))))
      .then(bytes => ctx.decodeAudioData(bytes))
      .then(buf => makeSeamless(ctx, buf, f.blend))
      .catch(() => { recordings.delete(kind); return null }) // missing or unreadable: the made sound plays, and the next pick tries again
    recordings.set(kind, p)
  }
  return p
}

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

// The made sounds, for when a recording is not there

function rain(ctx: AudioContext, out: AudioNode, stops: Stops) {
  const hiss = layer(ctx, out, stops, 'white', 0.35, filter(ctx, 'highpass', 600), filter(ctx, 'lowpass', 7500))
  wobble(ctx, hiss.gain, 0.17, 0.06, stops)
  layer(ctx, out, stops, 'brown', 0.5, filter(ctx, 'lowpass', 420)) // the far, low part of rain
}

function sea(ctx: AudioContext, out: AudioNode, stops: Stops) {
  const swell = layer(ctx, out, stops, 'brown', 0.8, filter(ctx, 'lowpass', 700)) // the body of the sea, rising and falling like waves
  wobble(ctx, swell.gain, 0.1, 0.35, stops)
  const foam = layer(ctx, out, stops, 'white', 0.06, filter(ctx, 'bandpass', 1500, 0.6)) // the hiss as each wave breaks
  wobble(ctx, foam.gain, 0.1, 0.05, stops)
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
    timer = setTimeout(play, CHORD_SECONDS * 1000)
    if (ctx.state !== 'running') return // the clock stands still until sound is allowed, so notes scheduled now would all land on the same moment
    const t = ctx.currentTime
    for (const f of CHORDS[n++ % CHORDS.length]) {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.type = 'triangle'; o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 14 // a little tape drift
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16, t + 0.8); g.gain.linearRampToValueAtTime(0.0001, t + CHORD_SECONDS + 0.6)
      o.connect(g).connect(pad); o.start(t); o.stop(t + CHORD_SECONDS + 0.7)
    }
  }
  play()
  stops.push(() => clearTimeout(timer))
  const crackle = layer(ctx, out, stops, 'white', 0.018, filter(ctx, 'highpass', 3500)) // the record
  wobble(ctx, crackle.gain, 7, 0.012, stops)
}

const MAKERS: Record<Kind, (ctx: AudioContext, out: AudioNode, stops: Stops) => void> = { rain, sea, lofi }

function standIn(ctx: AudioContext, out: AudioNode): GainNode {
  const g = gainOf(ctx, STAND_IN)
  g.connect(out)
  return g
}

function playRecording(ctx: AudioContext, kind: Kind, buf: AudioBuffer, out: AudioNode, stops: Stops) {
  const f = FILES[kind]
  const src = ctx.createBufferSource()
  src.buffer = buf; src.loop = true; src.playbackRate.value = f.rate
  const level = gainOf(ctx, f.gain)
  ;(f.lowpass ? src.connect(filter(ctx, 'lowpass', f.lowpass)) : src).connect(level).connect(out)
  src.start(); stops.push(() => src.stop())
}

/** Starts a sound (replacing the one playing). False when this browser cannot make sound. */
export function startAmbient(kind: Kind, volume: number): boolean {
  stopAmbient()
  try {
    const ctx = audioContext()
    if (!ctx) return false
    const mine = ++token
    const master = ctx.createGain()
    master.gain.value = 0
    master.gain.setTargetAtTime(volume, ctx.currentTime, 0.4) // fades in
    master.connect(ctx.destination)
    const stops: Stops = []
    playing = {
      kind, master,
      stop: () => {
        master.gain.setTargetAtTime(0, ctx.currentTime, 0.1)
        setTimeout(() => { stops.forEach(s => { try { s() } catch { /* already stopped */ } }); master.disconnect() }, 500)
      },
    }
    void recording(ctx, kind).then(buf => {
      if (mine !== token) return // stopped, or another sound picked, while it loaded
      try { if (buf) playRecording(ctx, kind, buf, master, stops); else MAKERS[kind](ctx, standIn(ctx, master), stops) } catch { /* no sound this time */ }
    })
    return true
  } catch { return false }
}

export function setAmbientVolume(volume: number) {
  if (!playing) return
  playing.master.gain.setTargetAtTime(volume, playing.master.context.currentTime, 0.05)
}

export function stopAmbient() {
  token++
  playing?.stop()
  playing = null
}

export const ambientPlaying = (): Kind | null => playing?.kind ?? null
