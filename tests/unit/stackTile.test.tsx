// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { StackTile } from '@/components/ui/StackTile'

afterEach(cleanup)
const show = (extra: Partial<Parameters<typeof StackTile>[0]> = {}) => render(
  <div role="list" aria-label="Notes">
    <StackTile motif="sheets" color="#1D9E75" title="Krebs cycle" href="/notes/a" tag={<span>Biology</span>} big="14 Oct" bigLabel="last edited" side="Lab notes" {...extra} />
  </div>,
)

describe('StackTile (the deck tile, for every kind of item)', () => {
  it('is one link with the title, the course, the big detail and its label, and the side detail', () => {
    show()
    const link = screen.getByRole('link', { name: /Krebs cycle/ })
    expect(link.getAttribute('href')).toBe('/notes/a')
    for (const t of ['Biology', '14 Oct', 'last edited', 'Lab notes']) expect(within(link).getByText(t)).toBeTruthy()
    expect(link.querySelector('[data-title]')!.textContent).toBe('Krebs cycle')
    expect(link.querySelector('[data-motif="sheets"]')).toBeTruthy()
  })
  it('draws the object for each kind: index cards, ruled sheets, a recording strip', () => {
    for (const motif of ['cards', 'sheets', 'strip'] as const) {
      cleanup()
      show({ motif })
      expect(screen.getByRole('link').querySelector(`[data-motif="${motif}"]`)!.getAttribute('aria-hidden')).toBe('true')
    }
  })
  it('can be ticked instead of opened, and has a menu button', () => {
    const onMenu = vi.fn(), onToggle = vi.fn()
    show({ onMenu })
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Krebs cycle' }))
    expect(onMenu).toHaveBeenCalled()
    cleanup()
    show({ select: { on: true, onToggle } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Krebs cycle' }))
    expect(onToggle).toHaveBeenCalled()
  })
})
