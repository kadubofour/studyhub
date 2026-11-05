import { describe, it, expect, vi, afterEach } from 'vitest'
import { browserSpeakerIo, createSpeaker, splitLong, type SpeakerIo } from '@/lib/voice/speaker'

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
  it('says sentences together once two pieces are waiting, so the voice stays natural and a long reply is not a burst of requests', async () => {
    const { io, log, finish } = fakeIo()
    const sp = createSpeaker(io)
    for (const s of ['one.', 'two.', 'three.', 'four.', 'five.']) sp.add(s)
    await tick(); await tick()
    const fetched = () => log.filter(l => l.startsWith('fetch'))
    expect(fetched()).toEqual(['fetch:one.', 'fetch:two.', 'fetch:three.']) // one playing and two ready; the rest wait
    expect(sp.busy).toBe(true)
    await finish()
    expect(fetched().at(-1)).toBe('fetch:four. five.')
    await finish(); await finish()
    expect(log.filter(l => l.startsWith('play'))).toEqual(['play:one.', 'play:two.', 'play:three.', 'play:four. five.'])
    expect(sp.saying).toBe('four. five.')
  })
  it('joins no more than a step of a lesson says at once, and drops what was waiting when stopped', async () => {
    const { io, log } = fakeIo()
    const sp = createSpeaker(io)
    const long = 'x'.repeat(300)
    for (const s of ['a.', 'b.', long, long, long]) sp.add(s)
    await tick(); await tick()
    expect(log.filter(l => l.startsWith('fetch')).every(l => l.length <= 'fetch:'.length + 400)).toBe(true)
    sp.stop()
    expect(sp.busy).toBe(false)
  })
  it('breaks a sentence too long for one piece where it pauses, losing nothing', async () => {
    const pause = `${'word '.repeat(60).trim()}, ${'more '.repeat(80).trim()}`
    const parts = splitLong(pause)
    expect(parts.length).toBeGreaterThan(1)
    expect(parts[0].endsWith(',')).toBe(true)
    expect(parts.every(p => p.length <= 500)).toBe(true)
    expect(parts.join(' ')).toBe(pause)
    expect(splitLong('y'.repeat(1200)).every(p => p.length <= 500)).toBe(true)
    expect(splitLong('short')).toEqual(['short'])
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

describe('fetching the voice', () => {
  afterEach(() => { vi.unstubAllGlobals() })
  const respond = (...replies: (Response | Error)[]) => {
    const f = vi.fn(async () => { const r = replies.shift()!; if (r instanceof Error) throw r; return r })
    vi.stubGlobal('fetch', f)
    return f
  }
  const get = () => browserSpeakerIo().fetchAudio('Hello.', new AbortController().signal)
  it('tries a failure again before giving up on the voice', async () => {
    const f = respond(new Response('', { status: 502 }), new Response('mp3'))
    expect(await (await get())!.text()).toBe('mp3')
    expect(f).toHaveBeenCalledTimes(2)
    const g = respond(new Error('offline'), new Response('mp3'))
    expect(await (await get())!.text()).toBe('mp3')
    expect(g).toHaveBeenCalledTimes(2)
  })
  it('tries when told it is going too fast, and stops after the second failure', async () => {
    const f = respond(new Response('', { status: 429 }), new Response('', { status: 429 }))
    expect(await get()).toBeNull()
    expect(f).toHaveBeenCalledTimes(2)
  })
  it('does not ask again for what the server refuses as it stands', async () => {
    const f = respond(new Response('', { status: 400 }))
    expect(await get()).toBeNull()
    expect(f).toHaveBeenCalledTimes(1)
  })
})
