import { describe, it, expect } from 'vitest'
import { createSpeaker, type SpeakerIo } from '@/lib/voice/speaker'

const tick = () => new Promise(r => setTimeout(r, 0))

// plays sounds that end when told to, and records what was fetched and played
function fakeIo(opts: { failFetch?: (t: string) => boolean } = {}) {
  const log: string[] = []
  const ends: (() => void)[] = []
  const io: SpeakerIo = {
    fetchAudio: async t => { log.push(`fetch:${t}`); return opts.failFetch?.(t) ? null : new Blob([t]) },
    play: blob => {
      let end: () => void = () => {}
      const done = new Promise<void>(r => { end = r })
      blob.text().then(t => log.push(`play:${t}`))
      ends.push(end)
      return { done, stop: () => { log.push('stopped'); end() } }
    },
    say: t => { log.push(`say:${t}`); let end: () => void = () => {}; const done = new Promise<void>(r => { end = r }); ends.push(end); return { done, stop: () => end() } },
  }
  return { io, log, finish: async () => { ends.shift()?.(); await tick(); await tick() } }
}

describe('createSpeaker', () => {
  it('fetches each piece at once but plays them one after another, in order', async () => {
    const { io, log, finish } = fakeIo()
    const sp = createSpeaker(io)
    sp.add('one.'); sp.add('two.')
    await tick(); await tick()
    expect(log.filter(l => l.startsWith('fetch'))).toEqual(['fetch:one.', 'fetch:two.'])
    expect(log.filter(l => l.startsWith('play'))).toEqual(['play:one.'])
    expect(sp.saying).toBe('one.')
    await finish()
    expect(log.filter(l => l.startsWith('play'))).toEqual(['play:one.', 'play:two.'])
    expect(sp.saying).toBe('two.')
  })
  it('says when it starts and when it runs dry', async () => {
    const { io, finish } = fakeIo()
    const sp = createSpeaker(io)
    const events: string[] = []
    sp.onStart = () => events.push('start'); sp.onIdle = () => events.push('idle')
    sp.add('hello there.')
    await tick(); await tick()
    expect(events).toEqual(['start'])
    await finish(); await tick()
    expect(events).toEqual(['start', 'idle'])
    expect(sp.busy).toBe(false)
  })
  it('stops at once: what is playing ends and what is queued is dropped', async () => {
    const { io, log } = fakeIo()
    const sp = createSpeaker(io)
    const events: string[] = []
    sp.onIdle = () => events.push('idle')
    sp.add('one.'); sp.add('two.'); sp.add('three.')
    await tick(); await tick()
    sp.stop()
    await tick(); await tick()
    expect(log).toContain('stopped')
    expect(log.filter(l => l.startsWith('play'))).toEqual(['play:one.'])
    expect(sp.saying).toBe('')
    expect(sp.busy).toBe(false)
    expect(events).toEqual(['idle'])
    // and it can speak again afterwards
    sp.add('again.')
    await tick(); await tick()
    expect(log).toContain('play:again.')
  })
  it('uses the browser voice for a piece the server could not make', async () => {
    const { io, log, finish } = fakeIo({ failFetch: t => t === 'two.' })
    const sp = createSpeaker(io)
    sp.add('one.'); sp.add('two.')
    await tick(); await tick()
    await finish()
    expect(log).toContain('say:two.')
  })
  it('ignores empty pieces', async () => {
    const { io, log } = fakeIo()
    const sp = createSpeaker(io)
    sp.add('   ')
    await tick()
    expect(log).toEqual([])
    expect(sp.busy).toBe(false)
  })
})
