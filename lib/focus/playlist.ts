// A list of tracks played one after another in a shuffled order, each fading into the next, so a long study session does not hear the same song
// over and over. Tracks are streamed with <audio> elements (two, so one can fade out while the other fades in), not decoded whole into memory.

/** Seconds each track takes to fade into the next */
export const CROSSFADE = 4

/** The next track to play: a random one, but never the one that just played (unless it is the only one) */
export function pickNext(tracks: string[], last: string | null, random: () => number = Math.random): string {
  const choices = tracks.length > 1 ? tracks.filter(t => t !== last) : tracks
  return choices[Math.floor(random() * choices.length)]
}

interface Slot {
  el: HTMLAudioElement
  gain: GainNode
  source: MediaElementAudioSourceNode
  off: () => void
}

/**
 * Plays `tracks` into `out`. `onFail` is called once if nothing can be played (the first track cannot be loaded, or nearly everything fails), so
 * the caller can put a stand-in sound there instead. Returns a function that stops it all.
 */
export function startPlaylist(
  ctx: AudioContext, out: AudioNode, tracks: string[],
  opts: { make?: () => HTMLAudioElement; onFail: () => void },
): () => void {
  const make = opts.make ?? (() => { const a = new Audio(); a.preload = 'auto'; return a })
  let stopped = false, current: Slot | null = null, last: string | null = null, crossfading = false, everPlayed = false, failures = 0, failed = false
  const timers = new Set<ReturnType<typeof setTimeout>>()
  const taps: (() => void)[] = []

  const other = (s: Slot) => (s === slots[0] ? slots[1] : slots[0])
  const fail = () => { if (failed || stopped) return; failed = true; stop(); opts.onFail() }

  function play(slot: Slot) {
    const started = slot.el.play() as Promise<void> | undefined
    started?.catch((e: unknown) => {
      // A browser will not start sound before something is tapped: try again at the first tap or key press
      if ((e as Error)?.name !== 'NotAllowedError' || typeof document === 'undefined') return
      const retry = () => { off(); if (!stopped && current === slot) play(slot) }
      const off = () => { document.removeEventListener('pointerdown', retry); document.removeEventListener('keydown', retry) }
      document.addEventListener('pointerdown', retry, { once: true })
      document.addEventListener('keydown', retry, { once: true })
      taps.push(off)
    })
  }

  /** Starts the next track on this slot, fading up if it is joining one that is still playing */
  function begin(slot: Slot, fade: boolean) {
    const src = pickNext(tracks, last)
    last = src
    slot.el.src = src
    const g = slot.gain.gain, t = ctx.currentTime
    g.cancelScheduledValues(t)
    if (fade) { g.setValueAtTime(0, t); g.linearRampToValueAtTime(1, t + CROSSFADE) } else g.setValueAtTime(1, t)
    current = slot
    crossfading = false
    play(slot)
  }

  function crossfade() {
    if (!current) return
    crossfading = true
    const old = current, next = other(old)
    const g = old.gain.gain, t = ctx.currentTime
    g.cancelScheduledValues(t)
    g.setValueAtTime(g.value, t)
    g.linearRampToValueAtTime(0, t + CROSSFADE)
    begin(next, true)
    const timer = setTimeout(() => { timers.delete(timer); if (!stopped && old !== current) old.el.pause() }, (CROSSFADE + 0.5) * 1000)
    timers.add(timer)
  }

  function makeSlot(): Slot {
    const el = make()
    const source = ctx.createMediaElementSource(el)
    const gain = ctx.createGain()
    source.connect(gain)
    gain.connect(out)
    const slot: Slot = { el, gain, source, off: () => {} }
    const onTime = () => {
      if (slot !== current || crossfading) return
      const d = el.duration
      if (Number.isFinite(d) && d > CROSSFADE * 2 && d - el.currentTime <= CROSSFADE + 0.25) crossfade()
    }
    const onEnded = () => { if (slot === current) { begin(other(slot), false); slot.el.pause() } }
    const onPlaying = () => { everPlayed = true }
    const onError = () => {
      failures++
      if (!everPlayed || failures > tracks.length * 2) { fail(); return }
      if (slot === current) begin(other(slot), false) // that track is missing: the next one
    }
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('ended', onEnded)
    el.addEventListener('playing', onPlaying)
    el.addEventListener('error', onError)
    slot.off = () => {
      el.removeEventListener('timeupdate', onTime); el.removeEventListener('ended', onEnded)
      el.removeEventListener('playing', onPlaying); el.removeEventListener('error', onError)
    }
    return slot
  }

  const slots: [Slot, Slot] = [makeSlot(), makeSlot()]

  function stop() {
    if (stopped) return
    stopped = true
    timers.forEach(clearTimeout); timers.clear()
    taps.forEach(f => f()); taps.length = 0
    for (const s of slots) {
      s.off()
      s.el.pause()
      s.el.removeAttribute('src')
      s.el.load()
      try { s.source.disconnect(); s.gain.disconnect() } catch { /* already apart */ }
    }
  }

  begin(slots[0], false)
  return stop
}
