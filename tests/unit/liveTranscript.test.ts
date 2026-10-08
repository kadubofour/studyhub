// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createLiveTranscriber, speechRecognition, type Recognition } from '@/lib/lectures/liveTranscript'

const made: FakeRecognition[] = []
class FakeRecognition implements Recognition {
  continuous = false; interimResults = false; lang = ''
  onresult: Recognition['onresult'] = null; onend: Recognition['onend'] = null; onerror: Recognition['onerror'] = null
  started = 0; stopped = 0
  constructor() { made.push(this) }
  start() { this.started++ }
  stop() { this.stopped++; this.onend?.() }
  say(results: [string, boolean][], resultIndex = 0) {
    this.onresult?.({ resultIndex, results: results.map(([t, isFinal]) => ({ isFinal, 0: { transcript: t } })) })
  }
}
let clock = 0
const setup = () => {
  const lines: unknown[] = [], interim: string[] = [], blocked = vi.fn()
  const t = createLiveTranscriber({ Ctor: FakeRecognition, now: () => clock, onLine: l => lines.push(l), onInterim: s => interim.push(s), onBlocked: blocked })
  return { t, lines, interim, blocked }
}
beforeEach(() => { made.length = 0; clock = 0 })

describe('createLiveTranscriber', () => {
  it('times each line from when it was first heard to when it was final, on the recording clock', () => {
    const { t, lines, interim } = setup()
    t.start()
    expect(made[0]).toMatchObject({ continuous: true, interimResults: true, started: 1 })
    clock = 12
    made[0].say([['the krebs', false]])
    expect(interim.at(-1)).toBe('the krebs')
    clock = 15
    made[0].say([['The Krebs cycle.', true]])
    expect(lines).toEqual([{ start: 12, end: 15, text: 'The Krebs cycle.' }])
    expect(interim.at(-1)).toBe('')
  })
  it('restarts when the browser stops listening on its own, but not after stop', () => {
    const { t } = setup()
    t.start()
    made[0].onend?.()
    expect(made).toHaveLength(2)
    t.stop()
    expect(made).toHaveLength(2)
  })
  it('stops for good when the browser blocks speech recognition', () => {
    const { t, blocked } = setup()
    t.start()
    made[0].onerror?.({ error: 'not-allowed' })
    made[0].onend?.()
    expect(blocked).toHaveBeenCalled()
    expect(made).toHaveLength(1)
  })
  it('after a network or microphone error it waits longer before each retry, not in a tight loop', () => {
    vi.useFakeTimers()
    const { t } = setup()
    t.start()
    made[0].onerror?.({ error: 'network' })
    made[0].onend?.()
    expect(made).toHaveLength(1) // not straight away
    vi.advanceTimersByTime(1000)
    expect(made).toHaveLength(2)
    made[1].onerror?.({ error: 'network' })
    made[1].onend?.()
    vi.advanceTimersByTime(1000)
    expect(made).toHaveLength(2) // the wait doubles
    vi.advanceTimersByTime(1000)
    expect(made).toHaveLength(3)
    t.stop()
    made[2].onerror?.({ error: 'network' })
    made[2].onend?.()
    vi.advanceTimersByTime(60_000)
    expect(made).toHaveLength(3) // stopped: no retry
    vi.useRealTimers()
  })
  it('when another recognition takes over (another tab), it waits before trying again instead of fighting', () => {
    vi.useFakeTimers()
    const { t } = setup()
    t.start()
    made[0].onerror?.({ error: 'aborted' })
    made[0].onend?.()
    expect(made).toHaveLength(1)
    vi.advanceTimersByTime(1000)
    expect(made).toHaveLength(2)
    t.stop()
    vi.useRealTimers()
  })
  it('reports trouble while it retries, and clears it once speech comes through', () => {
    vi.useFakeTimers()
    const trouble: (string | null)[] = []
    const t = createLiveTranscriber({ Ctor: FakeRecognition, now: () => clock, onLine: () => {}, onInterim: () => {}, onTrouble: r => trouble.push(r) })
    t.start()
    made[0].onerror?.({ error: 'network' })
    expect(trouble.at(-1)).toBe('network')
    made[0].onend?.()
    vi.advanceTimersByTime(1000)
    made[1].say([['Hello.', true]])
    expect(trouble.at(-1)).toBeNull()
    t.stop()
    vi.useRealTimers()
  })
  it('finds the browser\'s speech recognition, if any', () => {
    expect(speechRecognition()).toBeNull()
    ;(window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition = FakeRecognition
    expect(speechRecognition()).toBe(FakeRecognition)
    delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
  })
})

describe('createLiveTranscriber: long recordings', () => {
  it('keeps going when a restart after the browser\'s own ~1 minute cut-off throws, trying again shortly', () => {
    vi.useFakeTimers()
    const orig = FakeRecognition.prototype.start
    let calls = 0
    FakeRecognition.prototype.start = function (this: FakeRecognition) { calls++; if (calls === 2) throw new Error('InvalidStateError'); orig.call(this) }
    try {
      const { t } = setup()
      t.start()
      expect(() => made[0].onend?.()).not.toThrow()
      vi.advanceTimersByTime(5000)
      expect(made.at(-1)?.started).toBe(1) // a later attempt did start listening
      t.stop()
    } finally { FakeRecognition.prototype.start = orig; vi.useRealTimers() }
  })
})
