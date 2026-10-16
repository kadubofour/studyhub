// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { LengthWheel } from '@/components/focus/LengthWheel'

afterEach(cleanup)
const setup = (minutes = 25) => {
  const onChange = vi.fn()
  render(<LengthWheel minutes={minutes} onChange={onChange} />)
  return { onChange, hours: () => screen.getByRole('spinbutton', { name: 'Hours' }), mins: () => screen.getByRole('spinbutton', { name: 'Minutes' }) }
}

describe('LengthWheel', () => {
  it('shows the length as hours and minutes, for a screen reader too', () => {
    const { hours, mins } = setup(95)
    expect(hours().getAttribute('aria-valuenow')).toBe('1')
    expect(mins().getAttribute('aria-valuenow')).toBe('35')
    expect(mins().getAttribute('aria-valuetext')).toBe('35 min')
  })

  it('the arrow keys move a minute at a time, Page keys five', () => {
    const { onChange, mins } = setup(25)
    fireEvent.keyDown(mins(), { key: 'ArrowUp' }); expect(onChange).toHaveBeenLastCalledWith(24)
    fireEvent.keyDown(mins(), { key: 'ArrowDown' }); expect(onChange).toHaveBeenLastCalledWith(26)
    fireEvent.keyDown(mins(), { key: 'PageDown' }); expect(onChange).toHaveBeenLastCalledWith(30)
    fireEvent.keyDown(mins(), { key: 'PageUp' }); expect(onChange).toHaveBeenLastCalledWith(20)
  })

  it('the hours drum adds whole hours and keeps the minutes', () => {
    const { onChange, hours } = setup(25)
    fireEvent.keyDown(hours(), { key: 'ArrowDown' })
    expect(onChange).toHaveBeenLastCalledWith(85)
  })

  it('never goes below one minute or above three hours', () => {
    const a = setup(1)
    fireEvent.keyDown(a.mins(), { key: 'ArrowUp' }) // 0 minutes, 0 hours
    expect(a.onChange).toHaveBeenLastCalledWith(1)
    cleanup()
    const b = setup(150)
    fireEvent.keyDown(b.hours(), { key: 'End' }) // 3 hours and 30 minutes is too long
    expect(b.onChange).toHaveBeenLastCalledWith(180)
  })

  it('ignores other keys', () => {
    const { onChange, mins } = setup(25)
    fireEvent.keyDown(mins(), { key: 'a' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('winds a drum to a number when it is tapped', () => {
    const scrollTo = vi.fn()
    Element.prototype.scrollTo = scrollTo as never
    const { mins } = setup(25)
    fireEvent.click(mins().querySelectorAll('div')[1 + 40]) // the number 40: one spacer row, then 00..
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 40 * 40 }))
  })

  it('settles on the number in the middle band when scrolling stops', () => {
    vi.useFakeTimers()
    const { onChange, mins } = setup(25)
    Object.defineProperty(mins(), 'scrollTop', { configurable: true, value: 30 * 40 })
    fireEvent.scroll(mins())
    vi.advanceTimersByTime(200)
    expect(onChange).toHaveBeenLastCalledWith(30)
    vi.useRealTimers()
  })
})
