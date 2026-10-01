import { describe, it, expect } from 'vitest'
import {
  createTimer, startTimer, pauseTimer, elapsedMs, remainingMs, isFinished,
  nextMode, shouldLogSession, markLogged, durationFor, MIN_LOG_MS,
} from '@/lib/timer'

const MIN = 60_000
const T0 = 1_000_000

describe('timer', () => {
  it('counts from timestamps, so long gaps (sleep/tab hidden) are handled', () => {
    const s = startTimer(createTimer('focus', 25 * MIN), T0)
    expect(remainingMs(s, T0 + 10 * MIN)).toBe(15 * MIN)
    expect(remainingMs(s, T0 + 3 * 60 * MIN)).toBe(0) // laptop slept for 3h
    expect(isFinished(s, T0 + 3 * 60 * MIN)).toBe(true)
  })
  it('pause freezes elapsed time; resume continues', () => {
    let s = startTimer(createTimer('focus', 25 * MIN), T0)
    s = pauseTimer(s, T0 + 5 * MIN)
    expect(elapsedMs(s, T0 + 50 * MIN)).toBe(5 * MIN)
    s = startTimer(s, T0 + 50 * MIN)
    expect(elapsedMs(s, T0 + 52 * MIN)).toBe(7 * MIN)
    expect(s.firstStartedAt).toBe(T0)
  })
  it('start and pause are idempotent', () => {
    const s = startTimer(createTimer('focus', MIN), T0)
    expect(startTimer(s, T0 + 999)).toBe(s)
    const p = pauseTimer(s, T0 + 10)
    expect(pauseTimer(p, T0 + 20)).toBe(p)
  })
})

describe('nextMode', () => {
  it('long break after every Nth focus session, short otherwise, focus after breaks', () => {
    expect(nextMode('focus', 1, 4)).toBe('short')
    expect(nextMode('focus', 4, 4)).toBe('long')
    expect(nextMode('focus', 8, 4)).toBe('long')
    expect(nextMode('short', 1, 4)).toBe('focus')
    expect(nextMode('long', 4, 4)).toBe('focus')
  })
})

describe('logging', () => {
  it('logs a finished focus session exactly once', () => {
    let s = startTimer(createTimer('focus', 25 * MIN), T0)
    const end = T0 + 25 * MIN
    expect(shouldLogSession(s, end)).toBe(true)
    s = markLogged(s)
    expect(shouldLogSession(s, end + 10 * MIN)).toBe(false)
  })
  it('logs an early stop only at ≥ 5 minutes', () => {
    const s = startTimer(createTimer('focus', 25 * MIN), T0)
    expect(shouldLogSession(s, T0 + MIN_LOG_MS - 1)).toBe(false)
    expect(shouldLogSession(s, T0 + MIN_LOG_MS)).toBe(true)
  })
  it('never logs breaks', () => {
    const s = startTimer(createTimer('short', 5 * MIN), T0)
    expect(shouldLogSession(s, T0 + 5 * MIN)).toBe(false)
  })
})

describe('durationFor', () => {
  it('maps profile minutes', () => {
    const p = { focus_minutes: 25, short_break_minutes: 5, long_break_minutes: 15 }
    expect(durationFor('focus', p)).toBe(25 * MIN)
    expect(durationFor('short', p)).toBe(5 * MIN)
    expect(durationFor('long', p)).toBe(15 * MIN)
  })
})
