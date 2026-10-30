// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ThemeTiles } from '@/components/settings/ThemeTiles'

afterEach(cleanup)

describe('the theme tiles', () => {
  it('are System, Light and Dark, with the chosen one checked and the only one in the tab order', () => {
    render(<ThemeTiles value="dark" onChange={() => {}} />)
    const tiles = screen.getAllByRole('radio')
    expect(tiles.map(t => t.getAttribute('aria-label'))).toEqual(['System', 'Light', 'Dark'])
    expect(tiles.map(t => t.getAttribute('aria-checked'))).toEqual(['false', 'false', 'true'])
    expect(tiles.map(t => t.tabIndex)).toEqual([-1, -1, 0])
  })
  it('choose by a click, or with the arrow keys', () => {
    const onChange = vi.fn()
    render(<ThemeTiles value="system" onChange={onChange} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Light' }))
    expect(onChange).toHaveBeenLastCalledWith('light')
    fireEvent.keyDown(screen.getByRole('radio', { name: 'System' }), { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenLastCalledWith('dark')
  })
  it('draw System half light and half dark', () => {
    render(<ThemeTiles value="system" onChange={() => {}} />)
    const system = screen.getByRole('radio', { name: 'System' })
    expect(system.innerHTML).toContain('background: rgb(246, 245, 241)') // the light half's page
    expect(system.innerHTML).toContain('background: rgb(28, 28, 30)') // the dark half's page
  })
})
