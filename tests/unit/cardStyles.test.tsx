// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import { Flame } from 'lucide-react'
import { SplitCard, StatStrip, TintTile } from '@/components/ui/cards'

afterEach(cleanup)
const colorOf = (el: Element) => (el as HTMLElement).style.getPropertyValue('--c')

describe('TintTile (A)', () => {
  it('shows its label and value on a wash of its colour, with an icon in a circle', () => {
    const { container } = render(<TintTile color="#1D9E75" icon={Flame} label="Tasks today">4</TintTile>)
    expect(screen.getByText('Tasks today')).toBeTruthy()
    expect(screen.getByText('4')).toBeTruthy()
    expect(colorOf(container.firstElementChild!)).toBe('#1D9E75')
    expect(container.querySelector('svg[aria-hidden="true"]')).toBeTruthy()
    expect(container.firstElementChild!.hasAttribute('data-tint')).toBe(true) // so a calmer look can take the colour out
  })
  it('is a link when it has somewhere to go', () => {
    render(<TintTile color="#D4537E" icon={Flame} label="Cards due" href="/review">23</TintTile>)
    expect(screen.getByRole('link', { name: /Cards due/ }).getAttribute('href')).toBe('/review')
  })
})

describe('SplitCard (D)', () => {
  it('puts the figure and icon in a coloured block and the words beside it', () => {
    const { container } = render(<SplitCard color="#1D9E75" icon={Flame} value="7" title="Biology" sub="2 notes · 1 deck" href="/courses/bio" />)
    const link = screen.getByRole('link', { name: /^Biology/ }) // the count in the block is decoration, so the name starts with the course
    expect(link.getAttribute('href')).toBe('/courses/bio')
    expect(within(link).getByText('7')).toBeTruthy()
    expect(within(link).getByText('2 notes · 1 deck')).toBeTruthy()
    expect(colorOf(container.firstElementChild!)).toBe('#1D9E75')
  })
  it('darkens the block so white text on it stays readable whatever the course colour', () => {
    render(<SplitCard color="#BA7517" icon={Flame} value="7" title="Chem" sub="x" href="/c" />)
    const block = screen.getByText('7').closest('[data-block]') as HTMLElement
    expect(block.className).toContain('color-mix')
    expect(block.className).toContain('black')
  })
})

describe('StatStrip (C)', () => {
  it('is a named list of figures divided by thin rules', () => {
    render(<StatStrip label="Study totals" items={[{ label: 'Notes', value: '12' }, { label: 'Flashcards', value: '80' }, { label: 'Focus time', value: '5h 30m', sub: 'this week' }]} />)
    const list = screen.getByRole('list', { name: 'Study totals' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0].textContent).toContain('Notes')
    expect(items[0].textContent).toContain('12')
    expect(items[2].textContent).toContain('this week')
  })
  it('says nothing for no items', () => {
    const { container } = render(<StatStrip label="x" items={[]} />)
    expect(container.firstElementChild).toBeNull()
  })
})
