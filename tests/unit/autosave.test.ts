import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createAutosaver, type SaveStatus } from '@/lib/ui/autosave'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

function deferred() {
  let resolve!: () => void, reject!: (e: unknown) => void
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('createAutosaver', () => {
  it('debounces: only the last value within the delay is saved', async () => {
    const saved: string[] = []
    const a = createAutosaver<string>(async v => { saved.push(v) }, () => {}, 1000)
    a.update('a'); a.update('ab'); a.update('abc')
    await vi.advanceTimersByTimeAsync(999)
    expect(saved).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(saved).toEqual(['abc'])
  })

  it('saves the newest text when edits happen during a slow save', async () => {
    const saved: string[] = []
    const first = deferred()
    let call = 0
    const a = createAutosaver<string>(async v => { call++; if (call === 1) await first.promise; saved.push(v) }, () => {}, 1000)
    a.update('one')
    await vi.advanceTimersByTimeAsync(1000) // save of "one" in flight
    a.update('two')
    await vi.advanceTimersByTimeAsync(1000) // timer fires while still in flight
    first.resolve()
    await vi.runAllTimersAsync()
    expect(saved).toEqual(['one', 'two'])
  })

  it('flushing with nothing to save does not claim "Saved"', async () => {
    const statuses: SaveStatus[] = []
    const save = vi.fn(async () => {})
    const a = createAutosaver<string>(save, s => { statuses.push(s) }, 1000)
    await a.flush()
    expect(save).not.toHaveBeenCalled()
    expect(statuses).toEqual([])
  })

  it('flush saves immediately (used when leaving the page)', async () => {
    const saved: string[] = []
    const a = createAutosaver<string>(async v => { saved.push(v) }, () => {}, 1000)
    a.update('x')
    await a.flush()
    expect(saved).toEqual(['x'])
    expect(a.hasPending()).toBe(false)
  })

  it('keeps the value after a failed save and reports error; flush retries it', async () => {
    const statuses: SaveStatus[] = []
    let fail = true
    const saved: string[] = []
    const a = createAutosaver<string>(async v => { if (fail) throw new Error('net'); saved.push(v) }, s => statuses.push(s), 1000)
    a.update('keep me')
    await vi.advanceTimersByTimeAsync(1000)
    expect(statuses.at(-1)).toBe('error')
    expect(a.hasPending()).toBe(true)
    fail = false
    await a.flush()
    expect(saved).toEqual(['keep me'])
    expect(statuses.at(-1)).toBe('saved')
  })

  it('retries a failed save by itself (backoff), with no further edits or navigation', async () => {
    let failures = 2
    const saved: string[] = []
    const statuses: SaveStatus[] = []
    const a = createAutosaver<string>(async v => { if (failures-- > 0) throw new Error('5xx'); saved.push(v) }, s => statuses.push(s), 1000)
    a.update('important')
    await vi.advanceTimersByTimeAsync(1000) // first attempt fails
    expect(statuses.at(-1)).toBe('error')
    await vi.advanceTimersByTimeAsync(30_000) // backoff retries run on their own
    expect(saved).toEqual(['important'])
    expect(statuses.at(-1)).toBe('saved')
    expect(a.hasPending()).toBe(false)
  })

  it('stops retrying an error that can never succeed (e.g. a database rule), and says so', async () => {
    let calls = 0
    const statuses: SaveStatus[] = []
    const permanent = Object.assign(new Error('violates row-level security'), { code: '42501' })
    const a = createAutosaver<string>(async () => { calls++; throw permanent }, s => statuses.push(s), 1000)
    a.update('x')
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(5 * 60_000)
    expect(calls).toBe(1)
    expect(statuses.at(-1)).toBe('failed')
  })

  it('keeps retrying network failures', async () => {
    let calls = 0
    const a = createAutosaver<string>(async () => { calls++; throw new TypeError('Failed to fetch') }, () => {}, 1000)
    a.update('x')
    await vi.advanceTimersByTimeAsync(1000 + 60_000)
    expect(calls).toBeGreaterThan(2)
  })

  it('a newer edit made during a failing save is not overwritten by the old value', async () => {
    const saved: string[] = []
    const first = deferred()
    let call = 0
    const a = createAutosaver<string>(async v => { call++; if (call === 1) { await first.promise; throw new Error('x') } saved.push(v) }, () => {}, 1000)
    a.update('old')
    await vi.advanceTimersByTimeAsync(1000)
    a.update('new')
    first.reject(new Error('x'))
    await vi.advanceTimersByTimeAsync(0)
    await a.flush()
    expect(saved).toEqual(['new'])
  })
})
