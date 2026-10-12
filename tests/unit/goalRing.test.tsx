// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { GoalRing } from '@/components/home/GoalRing'

afterEach(cleanup)

describe('GoalRing', () => {
  it('is a progress bar for assistive technology, with the amount in words', () => {
    render(<GoalRing percent={45} label="54m of 2h focus" />)
    const bar = screen.getByRole('progressbar', { name: 'Focus goal progress' })
    expect(bar.getAttribute('aria-valuenow')).toBe('45')
    expect(bar.getAttribute('aria-valuemin')).toBe('0')
    expect(bar.getAttribute('aria-valuemax')).toBe('100')
    expect(bar.getAttribute('aria-valuetext')).toBe('54m of 2h focus')
    expect(screen.getByText('45%')).toBeTruthy()
    expect(screen.getByText('54m of 2h focus')).toBeTruthy()
  })
  it('never goes below 0 or above 100', () => {
    render(<GoalRing percent={250} label="x" />)
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100')
    cleanup()
    render(<GoalRing percent={-5} label="x" />)
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0')
  })
  it('fills the ring in proportion', () => {
    const { container } = render(<GoalRing percent={50} label="x" />)
    const arc = container.querySelector('circle[data-arc]') as SVGCircleElement
    const total = Number(arc.getAttribute('stroke-dasharray'))
    expect(Number(arc.getAttribute('stroke-dashoffset'))).toBeCloseTo(total / 2, 1)
  })
})
