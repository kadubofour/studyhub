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

describe('the dock on a phone', () => {
  it('is a small pill of icons, with each place named for screen readers', () => {
    const src = fs.readFileSync('components/shell/AppShell.tsx', 'utf8')
    expect(src).toContain('mx-auto flex w-fit items-center gap-1 rounded-full')
    expect(src).toContain('aria-label={label}')
    expect(src).not.toContain('{short ?? label}')
  })
})

describe('Home\'s greeting on a phone', () => {
  it('the focus timer is one row: the clock on the left, its buttons on the right', async () => {
    const { HeroFocus } = await import('@/components/home/HeroFocus')
    render(<HeroFocus mode="Focus" clock="25:00" running={false} resumable={false} onToggle={vi.fn()} />)
    const box = screen.getByText('25:00').closest('[data-hero-focus]')!
    expect(box.className).toContain('max-sm:flex')
    expect(box.className).toContain('max-sm:justify-between')
    expect(screen.getByText('25:00').className).toContain('max-sm:text-3xl')
  })
  it('sits closer under the greeting on a phone', () => {
    const src = fs.readFileSync('app/(app)/home/page.tsx', 'utf8')
    expect(src).toContain('mt-5 flex flex-wrap items-center justify-between gap-4 sm:mt-7 sm:gap-6')
  })
})

describe('the focus timer on Home, on a phone', () => {
  it('fits its row: Start is short (the full name stays for screen readers) and Open is left to the top bar\'s timer', async () => {
    const { HeroFocus } = await import('@/components/home/HeroFocus')
    render(<HeroFocus mode="Focus" clock="25:00" running={false} resumable={false} onToggle={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Start focus' }).querySelector('[class~="max-sm:sr-only"]')!.textContent).toBe(' focus')
    expect(screen.getByRole('link', { name: 'Open' }).className).toContain('max-sm:hidden')
  })
  it('the greeting card is less padded on a phone', () => {
    expect(fs.readFileSync('app/(app)/home/page.tsx', 'utf8')).toContain('className="hero hero-page max-sm:!pb-6 max-sm:!pt-6"')
  })
})

describe('Notes filters on a phone', () => {
  it('search on its own line, then the course, view and sort in one row that scrolls sideways', () => {
    const src = fs.readFileSync('components/notes/NotesSidebar.tsx', 'utf8')
    expect(src).toContain('<div className="relative min-w-48 flex-1 max-sm:basis-full">')
    expect(src).toContain('<div data-filter-row className="no-scrollbar -mx-5 flex min-w-0 gap-2 overflow-x-auto px-5 sm:mx-0 sm:overflow-visible sm:px-0 [&>*]:shrink-0">')
  })
})

describe('Library filters on a phone', () => {
  const src = () => fs.readFileSync('app/(app)/library/page.tsx', 'utf8')
  it('sort and layout share one row under the search', () => {
    expect(src()).toContain('<div className="relative min-w-48 flex-1 max-sm:basis-full">')
    expect(src()).toContain('<div data-filter-row className="flex items-center gap-2 max-sm:w-full max-sm:justify-between">')
  })
  it('the kinds are one row that scrolls sideways, not two', () => {
    expect(src()).toContain('<div role="group" aria-label="Kinds" className="no-scrollbar -mx-5 mb-5 flex gap-1.5 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&>*]:shrink-0">')
  })
})
