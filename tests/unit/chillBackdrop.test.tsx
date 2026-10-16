// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { ChillBackdrop } from '@/components/focus/ChillBackdrop'

afterEach(cleanup)

describe('ChillBackdrop', () => {
  it('mixes the student\'s own accent with the colour of the session, so a break shows both', () => {
    const { container } = render(<ChillBackdrop />)
    const html = container.innerHTML
    expect(html).toContain('var(--user-solid)') // the accent they picked
    expect(html).toContain('var(--accent-glow)') // the session's colour (the accent itself during focus)
    expect(html).toContain('var(--accent-solid)')
  })

  it('is decoration: hidden from screen readers and not clickable', () => {
    const { container } = render(<ChillBackdrop />)
    const root = container.firstElementChild!
    expect(root.getAttribute('aria-hidden')).toBe('true')
    expect(root.className).toContain('pointer-events-none')
  })

  it('has specks in both colours', () => {
    const { container } = render(<ChillBackdrop />)
    const specks = [...container.querySelectorAll('.chill-speck')] as HTMLElement[]
    const colours = new Set(specks.map(s => s.style.background || s.style.backgroundColor))
    expect(specks.length).toBeGreaterThan(8)
    expect(colours.size).toBe(2)
  })
})
