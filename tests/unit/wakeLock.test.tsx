// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { useWakeLock } from '@/lib/focus/wakeLock'

const release = vi.fn(async () => {})
const request = vi.fn(async (_t: 'screen') => ({ release }))
const hidden = (v: 'visible' | 'hidden') => Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v })
function Probe({ on }: { on: boolean }) { useWakeLock(on); return null }

beforeEach(() => { request.mockClear(); release.mockClear(); hidden('visible'); Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } }) })
afterEach(() => { cleanup(); hidden('visible'); Reflect.deleteProperty(navigator, 'wakeLock') })

describe('useWakeLock', () => {
  it('keeps the screen on while active, and lets go when it stops', async () => {
    const { rerender } = render(<Probe on />)
    await act(async () => {})
    expect(request).toHaveBeenCalledWith('screen')
    rerender(<Probe on={false} />)
    await act(async () => {})
    expect(release).toHaveBeenCalledTimes(1)
  })
  it('does nothing while inactive', async () => {
    render(<Probe on={false} />)
    await act(async () => {})
    expect(request).not.toHaveBeenCalled()
  })
  it('takes the lock again when the student comes back to the tab', async () => {
    render(<Probe on />)
    await act(async () => {})
    hidden('hidden'); await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(request).toHaveBeenCalledTimes(1) // not while hidden
    hidden('visible'); await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(request).toHaveBeenCalledTimes(2)
  })
  it('is fine in a browser without it, and when the browser refuses', async () => {
    Reflect.deleteProperty(navigator, 'wakeLock')
    render(<Probe on />)
    cleanup()
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => { throw new Error('denied') } } })
    render(<Probe on />)
    await act(async () => {})
  })
  it('releases a lock that arrives after it was no longer wanted', async () => {
    let grant: (s: { release: typeof release }) => void = () => {}
    request.mockImplementationOnce(() => new Promise(r => { grant = r }))
    const { rerender } = render(<Probe on />)
    rerender(<Probe on={false} />)
    await act(async () => { grant({ release }) })
    expect(release).toHaveBeenCalledTimes(1)
  })
})
