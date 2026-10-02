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
