// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { LengthWheel } from '@/components/focus/LengthWheel'
import { MAX_SECONDS, MIN_SECONDS } from '@/lib/timer'

afterEach(cleanup)
// The length is in seconds
const setup = (seconds = 25 * 60) => {
  const onChange = vi.fn()
  render(<LengthWheel seconds={seconds} onChange={onChange} />)
  return {
    onChange, hours: () => screen.getByRole('spinbutton', { name: 'Hours' }),
    mins: () => screen.getByRole('spinbutton', { name: 'Minutes' }), secs: () => screen.getByRole('spinbutton', { name: 'Seconds' }),
  }
}

describe('LengthWheel', () => {
  it('shows the length as hours, minutes and seconds, for a screen reader too', () => {
    const { hours, mins, secs } = setup(3600 + 35 * 60 + 20)
    expect(hours().getAttribute('aria-valuenow')).toBe('1')
    expect(mins().getAttribute('aria-valuenow')).toBe('35')
    expect(secs().getAttribute('aria-valuenow')).toBe('20')
    expect(mins().getAttribute('aria-valuetext')).toBe('35 min')
    expect(secs().getAttribute('aria-valuetext')).toBe('20 sec')
  })

  it('the arrow keys move one at a time, Page keys five minutes or five seconds', () => {
    const { onChange, mins, secs } = setup(25 * 60)
    fireEvent.keyDown(mins(), { key: 'ArrowUp' }); expect(onChange).toHaveBeenLastCalledWith(24 * 60)
    fireEvent.keyDown(mins(), { key: 'ArrowDown' }); expect(onChange).toHaveBeenLastCalledWith(26 * 60)
    fireEvent.keyDown(mins(), { key: 'PageDown' }); expect(onChange).toHaveBeenLastCalledWith(30 * 60)
    fireEvent.keyDown(mins(), { key: 'PageUp' }); expect(onChange).toHaveBeenLastCalledWith(20 * 60)
    fireEvent.keyDown(secs(), { key: 'ArrowDown' }); expect(onChange).toHaveBeenLastCalledWith(25 * 60 + 1)
    fireEvent.keyDown(secs(), { key: 'PageDown' }); expect(onChange).toHaveBeenLastCalledWith(25 * 60 + 5)
  })

  it('the hours drum adds whole hours and keeps the minutes and seconds', () => {
    const { onChange, hours } = setup(25 * 60 + 30)
    fireEvent.keyDown(hours(), { key: 'ArrowDown' })
    expect(onChange).toHaveBeenLastCalledWith(3600 + 25 * 60 + 30)
  })

  it('never goes below the shortest session or above three hours', () => {
    const a = setup(MIN_SECONDS)
    fireEvent.keyDown(a.secs(), { key: 'ArrowUp' }) // 4 seconds is too short
    expect(a.onChange).toHaveBeenLastCalledWith(MIN_SECONDS)
    cleanup()
    const b = setup(150 * 60)
    fireEvent.keyDown(b.hours(), { key: 'End' }) // 3 hours and 30 minutes is too long
    expect(b.onChange).toHaveBeenLastCalledWith(MAX_SECONDS)
    cleanup()
    const c = setup(MAX_SECONDS)
    fireEvent.keyDown(c.secs(), { key: 'ArrowDown' })
    expect(c.onChange).toHaveBeenLastCalledWith(MAX_SECONDS)
  })

  it('ignores other keys', () => {
    const { onChange, mins } = setup()
    fireEvent.keyDown(mins(), { key: 'a' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('winds a drum to a number when it is tapped', () => {
    const scrollTo = vi.fn()
    Element.prototype.scrollTo = scrollTo as never
    const { mins } = setup()
    fireEvent.click(mins().querySelectorAll('div')[1 + 40]) // the number 40: one spacer, then 00..
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 40 * 44 }))
  })

  it('settles on the number in the middle band when scrolling stops, on any of the drums', () => {
    vi.useFakeTimers()
    const { onChange, mins, secs } = setup(25 * 60)
    Object.defineProperty(mins(), 'scrollTop', { configurable: true, value: 30 * 44 })
    fireEvent.scroll(mins())
    vi.advanceTimersByTime(200)
    expect(onChange).toHaveBeenLastCalledWith(30 * 60)
    Object.defineProperty(secs(), 'scrollTop', { configurable: true, value: 45 * 44 })
    fireEvent.scroll(secs())
    vi.advanceTimersByTime(200)
    expect(onChange).toHaveBeenLastCalledWith(25 * 60 + 45)
    vi.useRealTimers()
  })

  it('fits three drums in a phone-wide ring', () => {
    const { hours } = setup()
    const drum = hours().parentElement!
    expect(drum.className).toMatch(/w-\[5\.5rem\]/) // 3 x 88px and the gaps stay inside 86% of a 375px screen
  })
})
