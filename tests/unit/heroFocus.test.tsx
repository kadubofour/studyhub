// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { HeroFocus } from '@/components/home/HeroFocus'

afterEach(cleanup)
const setup = (over: Partial<React.ComponentProps<typeof HeroFocus>> = {}) => {
  const onToggle = vi.fn()
  render(<HeroFocus mode="Focus" clock="25:00" running={false} resumable={false} onToggle={onToggle} {...over} />)
  return onToggle
}

describe('HeroFocus', () => {
  it('shows the mode and the time left', () => {
    setup()
    expect(screen.getByText('Focus')).toBeTruthy()
    expect(screen.getByText('25:00')).toBeTruthy()
  })
  it('starts the timer', () => {
    const onToggle = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Start focus' }))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })
  it('offers Pause while it runs and Resume once paused part way', () => {
    setup({ running: true })
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy()
    cleanup()
    setup({ resumable: true })
    expect(screen.getByRole('button', { name: 'Resume' })).toBeTruthy()
  })
  it('links to the Focus page', () => {
    setup()
    expect(screen.getByRole('link', { name: 'Open' }).getAttribute('href')).toBe('/focus')
  })
})
