// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import fs from 'node:fs'
import { BTN_OUTLINE, BTN_SOFT, BTN_SOLID } from '@/components/ui/buttonStyles'
import { CreateMenu } from '@/components/shell/CreateMenu'
import { CommandPalette } from '@/components/shell/CommandPalette'

afterEach(cleanup)

describe('buttons follow the look everywhere', () => {
  it('the shared main and outline buttons are the look\'s own buttons, and the soft one is a pill', () => {
    expect(BTN_SOLID.split(' ')).toContain('btn-primary')
    expect(BTN_OUTLINE.split(' ')).toContain('btn')
    expect(BTN_SOFT).toContain('rounded-full')
  })
})

describe('Create on a phone', () => {
  it('is a sheet over a dimmed page, with large tiles in two columns', () => {
    render(<CreateMenu from="dock" onPick={vi.fn()} onClose={vi.fn()} />)
    const menu = screen.getByRole('menu', { name: 'Create' })
    expect(menu.className).toContain('grid-cols-2')
    expect(document.querySelector('[data-create-backdrop]')).toBeTruthy()
  })
  it('tapping the dimmed page closes it', () => {
    const onClose = vi.fn()
    render(<CreateMenu from="dock" onPick={vi.fn()} onClose={onClose} />)
    fireEvent.pointerDown(document.querySelector('[data-create-backdrop]')!)
    expect(onClose).toHaveBeenCalled()
  })
  it('from the sidebar it is still a short list beside it, with no backdrop', () => {
    render(<CreateMenu from="wide" onPick={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('menu', { name: 'Create' }).className).not.toContain('grid-cols-2')
    expect(document.querySelector('[data-create-backdrop]')).toBeNull()
  })
})

describe('Search on a phone', () => {
  it('hides the keyboard hints on a touch screen', () => {
    render(<CommandPalette items={[]} onClose={vi.fn()} onRun={vi.fn()} />)
    for (const hint of [screen.getByText('to move'), screen.getByText('Esc')]) expect(hint.closest('[class*="pointer-coarse:hidden"]')).toBeTruthy()
  })
  it('keeps the search box itself on a touch screen', () => {
    render(<CommandPalette items={[]} onClose={vi.fn()} onRun={vi.fn()} />)
    expect(screen.getByRole('combobox', { name: 'Search or jump' }).closest('[class*="pointer-coarse:hidden"]')).toBeNull()
  })
})

describe('the calendar\'s add button on a phone', () => {
  it('sits above the dock, not on it', () => {
    const src = fs.readFileSync('components/calendar/CalendarToolbar.tsx', 'utf8')
    expect(src).toContain('bottom-[calc(7.25rem+env(safe-area-inset-bottom))]')
  })
})

describe('the Look picker on a phone', () => {
  it('shows two looks to a row', () => {
    const src = fs.readFileSync('components/settings/AppearanceCard.tsx', 'utf8')
    expect(src).toMatch(/role="radiogroup" aria-label="Look"/)
    expect(src).toContain('grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-3')
  })
})
