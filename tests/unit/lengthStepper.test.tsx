// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { LengthStepper, MAX_MINUTES, MIN_MINUTES, stepMinutes } from '@/components/focus/LengthStepper'

afterEach(cleanup)
const setup = (p: Partial<React.ComponentProps<typeof LengthStepper>> = {}) => {
  const onChange = vi.fn()
  render(<LengthStepper minutes={25} usual={25} disabled={false} onChange={onChange} {...p} />)
  return onChange
}

describe('stepMinutes', () => {
  it('moves to the next multiple of five, either way, and stays in range', () => {
    expect(stepMinutes(25, 1)).toBe(30)
    expect(stepMinutes(25, -1)).toBe(20)
    expect(stepMinutes(23, 1)).toBe(25)
    expect(stepMinutes(23, -1)).toBe(20)
    expect(stepMinutes(MAX_MINUTES, 1)).toBe(MAX_MINUTES)
    expect(stepMinutes(3, -1)).toBe(MIN_MINUTES)
  })
})

describe('LengthStepper', () => {
  it('steps by five with the buttons', () => {
    const onChange = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Five minutes longer' }))
    expect(onChange).toHaveBeenLastCalledWith(30)
    fireEvent.click(screen.getByRole('button', { name: 'Five minutes shorter' }))
    expect(onChange).toHaveBeenLastCalledWith(20)
  })

  it('takes any length that is typed, and keeps it in range', () => {
    const onChange = setup()
    const box = screen.getByRole('spinbutton', { name: 'Session length in minutes' })
    fireEvent.change(box, { target: { value: '37' } }); fireEvent.blur(box)
    expect(onChange).toHaveBeenLastCalledWith(37)
    fireEvent.change(box, { target: { value: '999' } }); fireEvent.blur(box)
    expect(onChange).toHaveBeenLastCalledWith(MAX_MINUTES)
    fireEvent.change(box, { target: { value: '0' } }); fireEvent.blur(box)
    expect(onChange).toHaveBeenLastCalledWith(MIN_MINUTES)
  })

  it('ignores nonsense and goes back to what it was', () => {
    const onChange = setup({ minutes: 40 })
    const box = screen.getByRole('spinbutton', { name: 'Session length in minutes' }) as HTMLInputElement
    fireEvent.change(box, { target: { value: '' } }); fireEvent.blur(box)
    expect(onChange).not.toHaveBeenCalled()
    expect(box.value).toBe('40')
  })

  it('commits with Enter', () => {
    const onChange = setup()
    const box = screen.getByRole('spinbutton', { name: 'Session length in minutes' })
    fireEvent.change(box, { target: { value: '90' } }); fireEvent.keyDown(box, { key: 'Enter' })
    expect(onChange).toHaveBeenLastCalledWith(90)
  })

  it('offers a way back to the usual length only when it is different', () => {
    const onChange = setup({ minutes: 45, usual: 25 })
    fireEvent.click(screen.getByRole('button', { name: 'Back to 25 min' }))
    expect(onChange).toHaveBeenCalledWith(25)
    cleanup()
    setup({ minutes: 25, usual: 25 })
    expect(screen.queryByRole('button', { name: /Back to/ })).toBeNull()
  })

  it('cannot be changed once the session has begun', () => {
    setup({ disabled: true, minutes: 45 })
    expect((screen.getByRole('spinbutton') as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Five minutes longer' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: /Back to/ })).toBeNull()
  })
})
