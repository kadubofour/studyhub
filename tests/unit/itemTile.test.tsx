// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { FileText } from 'lucide-react'
import { ItemList, ItemTile } from '@/components/ui/ItemTile'
import { parseView } from '@/lib/ui/listView'
import type { Layout } from '@/lib/ui/listView'

afterEach(cleanup)
const show = (layout: Layout, extra: Partial<Parameters<typeof ItemTile>[0]> = {}) => render(
  <ItemList label="Notes" layout={layout}>
    <ItemTile layout={layout} icon={FileText} color="#1D9E75" title="Krebs cycle" href="/notes/a" subtitle="Biology year 1" meta={<span>Biology</span>} aside="2 days ago" {...extra} />
  </ItemList>,
)

describe('ItemTile', () => {
  for (const layout of ['grid', 'list', 'icons'] as Layout[]) {
    it(`${layout}: one link with the title and every detail in it, inside a labelled list`, () => {
      show(layout)
      const list = screen.getByRole('list', { name: 'Notes' })
      expect(list.getAttribute('data-layout')).toBe(layout)
      const link = within(list).getByRole('link', { name: /Krebs cycle/ })
      expect(link.getAttribute('href')).toBe('/notes/a')
      for (const text of ['Biology year 1', 'Biology', '2 days ago']) expect(within(link).getByText(text)).toBeTruthy()
      expect(link.querySelector('[data-title]')!.textContent).toBe('Krebs cycle')
      expect(link.querySelector('[data-icon]')).toBeTruthy() // every layout shows the item's icon
    })
  }

  it('icons: a big icon and the name; the details are still there for screen readers, and a badge shows a count', () => {
    show('icons', { badge: 3 })
    const link = screen.getByRole('link', { name: /Krebs cycle/ })
    expect(within(link).getByText('2 days ago').closest('.sr-only')).toBeTruthy()
    expect(link.querySelector('[data-badge]')!.textContent).toBe('3')
    expect(link.getAttribute('title')).toBe('Krebs cycle')
  })

  it('can be selected instead of opened, and has its own menu button', () => {
    const onToggle = vi.fn(), onMenu = vi.fn()
    const { rerender } = show('grid', { onMenu })
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Krebs cycle' }))
    expect(onMenu).toHaveBeenCalled()
    rerender(<ItemList label="Notes" layout="grid"><ItemTile layout="grid" icon={FileText} title="Krebs cycle" href="/notes/a" select={{ on: true, onToggle }} /></ItemList>)
    const box = screen.getByRole('checkbox', { name: 'Select Krebs cycle' })
    expect(box.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(box)
    expect(onToggle).toHaveBeenCalled()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('an untitled item says so', () => {
    render(<ItemList label="Notes" layout="grid"><ItemTile layout="grid" icon={FileText} title="" href="/notes/a" /></ItemList>)
    expect(screen.getByRole('link', { name: /Untitled/ })).toBeTruthy()
  })
})

describe('the Icons layout is a choice on every page', () => {
  it('is kept when chosen', () => {
    expect(parseView('notes', { layout: 'icons', sort: 'title' })).toEqual({ layout: 'icons', sort: 'title' })
    expect(parseView('lectures', { layout: 'icons' }).layout).toBe('icons')
  })
})
