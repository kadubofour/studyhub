// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { FolderPlus } from 'lucide-react'
import { LibraryOverview } from '@/components/library/LibraryOverview'
import type { NotebookCard } from '@/lib/library/notebookCards'
import type { LibraryItem } from '@/lib/library/items'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
afterEach(() => { cleanup(); push.mockClear() })

const card = (id: string, name: string, over: Partial<NotebookCard> = {}, def = false): NotebookCard => ({
  notebook: { id, name, is_default: def }, counts: { note: 2, deck: 1, lecture: 0, file: 0, quiz: 0 }, total: 3, lastAt: '2030-05-10T02:00:00Z', color: '#1D9E75', ...over,
})
const setup = (cards: NotebookCard[], over: Record<string, unknown> = {}) => {
  const props = { cards, found: [] as LibraryItem[], bookName: () => 'Biology', q: '', onQ: vi.fn(), sort: 'recent' as const, onSort: vi.fn(), onMaterials: vi.fn(), create: [], onRename: vi.fn(), onDelete: vi.fn(), ...over }
  render(<LibraryOverview {...props} />)
  return props
}

describe('LibraryOverview', () => {
  it('draws each notebook as a notebook, saying only what is inside', () => {
    setup([card('b', 'Biology'), card('c', 'Chemistry', { total: 0, lastAt: null, counts: { note: 0, deck: 0, lecture: 0, file: 0, quiz: 0 } })])
    const items = within(screen.getByRole('list', { name: 'Notebooks' })).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByRole('link', { name: 'Biology' }).getAttribute('href')).toBe('/notebooks/b')
    expect(items[0].querySelector('[data-notebook-cover]')?.textContent).toContain('2 notes · 1 deck')
    expect(items[1].querySelector('[data-notebook-cover]')?.textContent).toContain('Empty')
    expect(items[0].textContent).not.toContain('Last updated')
  })
  it('pressing and holding a notebook opens the same menu as its ⋮ button', () => {
    setup([card('b', 'Biology')])
    fireEvent.contextMenu(screen.getByRole('link', { name: 'Biology' }))
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeTruthy()
  })
  it('makes notebooks only from the Create menu, and says where when there are none', () => {
    const onSelect = vi.fn()
    setup([], { create: [{ label: 'New notebook', icon: FolderPlus, onSelect }] })
    expect(screen.queryByRole('button', { name: 'Create new notebook' })).toBeNull()
    expect(screen.getByText('No notebooks yet. Use Create to make one.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'New notebook' }))
    expect(onSelect).toHaveBeenCalled()
  })
  it('has no course cards, plans or progress bars', () => {
    setup([card('b', 'Biology')])
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.queryByText(/study plan/i)).toBeNull()
  })
  it('puts search, Materials and Create in the toolbar', () => {
    const p = setup([card('b', 'Biology')])
    fireEvent.click(screen.getByRole('button', { name: 'Materials' }))
    fireEvent.change(screen.getByLabelText('Search notebooks'), { target: { value: 'bio' } })
    expect(p.onMaterials).toHaveBeenCalled()
    expect(p.onQ).toHaveBeenCalledWith('bio')
    expect(screen.getByRole('button', { name: 'Create' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'New notebook' })).toBeNull() // Create's menu makes notebooks
  })
  it('lists what a search finds inside the notebooks, with the notebook each is in, and says when nothing matches', () => {
    const found: LibraryItem[] = [{ kind: 'note', id: 'n1', title: 'Krebs cycle', course_id: null, notebook_id: 'b', at: '', meta: '', href: '/notes/n1' }]
    setup([], { q: 'krebs', found })
    const link = within(screen.getByRole('region', { name: 'Found in your notebooks' })).getByRole('link', { name: /Krebs cycle/ })
    expect(link.getAttribute('href')).toBe('/notes/n1')
    expect(link.textContent).toContain('in Biology')
    cleanup()
    setup([], { q: 'zzz' })
    expect(screen.getByText(/Nothing matches/)).toBeTruthy()
  })
  it('a card\'s menu opens, renames or deletes it; General cannot be deleted', () => {
    const p = setup([card('b', 'Biology'), card('g', 'General', {}, true)])
    fireEvent.click(screen.getByRole('button', { name: 'Options for Biology' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }))
    expect(p.onRename).toHaveBeenCalledWith(expect.objectContaining({ notebook: expect.objectContaining({ id: 'b' }) }))
    fireEvent.click(screen.getByRole('button', { name: 'Options for Biology' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))
    expect(p.onDelete).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Options for General' }))
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull()
  })
})
